import os
import random
import smtplib
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.auth import (
    verify_master_password,
    hash_master_password,
    create_access_token,
    decode_token
)
from app.redis_client import redis_client

router = APIRouter(prefix="/api/auth", tags=["auth"])

TWO_FA_TTL_SECONDS = 300  # 5 minutes


def generate_2fa_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def send_2fa_code_email(to_email: str, code: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_password:
        raise HTTPException(
            status_code=500,
            detail="SMTP не настроен. Укажите SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD"
        )

    if not to_email or "@" not in to_email:
        raise HTTPException(
            status_code=400,
            detail="Некорректная почта для 2FA"
        )

    message = EmailMessage()
    message["Subject"] = "Login verification code"
    message["From"] = smtp_from
    message["To"] = to_email
    message.set_content(
        f"Your verification code is: {code}\n\n"
        f"This code is valid for 5 minutes.\n"
        f"If this was not you, ignore this email."
    )

    try:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
            server.set_debuglevel(1)
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.send_message(message)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Не удалось отправить письмо с кодом: {str(e)}"
        )


def get_current_user(token: str, db: Session):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Неверный токен")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Некорректный токен")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    return user


def get_authorized_user(authorization: str, db: Session):
    if not authorization:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")

    token = authorization.replace("Bearer ", "")
    return get_current_user(token, db)


@router.post("/register")
async def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(
        models.User.username == user_data.username.strip()
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")

    new_user = models.User(
        username=user_data.username.strip(),
        master_password_hash=hash_master_password(user_data.master_password),
        twofa_enabled=False,
        twofa_email=None
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Пользователь создан",
        "user_id": new_user.id
    }


@router.post("/login", response_model=schemas.LoginResponse)
async def login(login_data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == "admin").first()

    if not user:
        user = models.User(
            username="admin",
            master_password_hash=hash_master_password("admin"),
            twofa_enabled=False,
            twofa_email=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not verify_master_password(login_data.master_password, user.master_password_hash):
        raise HTTPException(status_code=401, detail="Неверный мастер-пароль")

    if user.twofa_enabled:
        if not user.twofa_email:
            raise HTTPException(
                status_code=400,
                detail="Для 2FA не указана почта в настройках"
            )

        code = generate_2fa_code()
        redis_key = f"2fa_code:user:{user.id}"
        redis_client.setex(redis_key, TWO_FA_TTL_SECONDS, code)

        send_2fa_code_email(user.twofa_email, code)

        return schemas.LoginResponse(
            requires_2fa=True,
            token=None
        )

    token = create_access_token(data={"user_id": user.id})
    return schemas.LoginResponse(
        requires_2fa=False,
        token=token
    )


@router.post("/verify-2fa")
async def verify_2fa(
    verify_data: schemas.Verify2FARequest,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.username == "admin").first()

    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if not verify_master_password(verify_data.master_password, user.master_password_hash):
        raise HTTPException(status_code=401, detail="Неверный мастер-пароль")

    redis_key = f"2fa_code:user:{user.id}"
    saved_code = redis_client.get(redis_key)

    if not saved_code:
        raise HTTPException(status_code=400, detail="Код истек или не был запрошен")

    if saved_code != verify_data.two_factor_code:
        raise HTTPException(status_code=400, detail="Неверный код подтверждения")

    redis_client.delete(redis_key)

    token = create_access_token(data={"user_id": user.id})
    return {"token": token}


@router.get("/settings", response_model=schemas.AuthSettingsResponse)
async def get_auth_settings(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    return schemas.AuthSettingsResponse(
        twoFAEnabled=bool(user.twofa_enabled),
        twoFAEmail=user.twofa_email
    )


@router.post("/settings", response_model=schemas.AuthSettingsResponse)
async def save_auth_settings(
    settings: schemas.AuthSettingsUpdate,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    if settings.twoFAEnabled and not settings.twoFAEmail:
        raise HTTPException(
            status_code=400,
            detail="Укажите почту для 2FA"
        )

    user.twofa_enabled = bool(settings.twoFAEnabled)
    user.twofa_email = settings.twoFAEmail.strip() if settings.twoFAEmail else None

    db.commit()
    db.refresh(user)

    return schemas.AuthSettingsResponse(
        twoFAEnabled=bool(user.twofa_enabled),
        twoFAEmail=user.twofa_email
    )