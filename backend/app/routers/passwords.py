from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas
from app.database import get_db
from app.auth import decode_token, encrypt_password, decrypt_password

router = APIRouter(prefix="/api/passwords", tags=["passwords"])

def get_current_user(token: str, db: Session):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Неверный токен")
    user_id = payload.get("user_id")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user

@router.get("/", response_model=List[schemas.PasswordResponse])
async def get_passwords(
    master_password: str,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")
    
    token = authorization.replace("Bearer ", "")
    user = get_current_user(token, db)
    
    passwords = db.query(models.Password).filter(models.Password.user_id == user.id).all()
    
    result = []
    for pwd in passwords:
        decrypted = decrypt_password(pwd.encrypted_password, master_password)
        result.append(schemas.PasswordResponse(
            id=pwd.id,
            site=pwd.site,
            login=pwd.login,
            password=decrypted,
            category=pwd.category,
            user_id=pwd.user_id,
            created_at=pwd.created_at,
            updated_at=pwd.updated_at
        ))
    return result

@router.post("/", response_model=schemas.PasswordResponse)
async def add_password(
    password_data: schemas.PasswordCreate,
    master_password: str,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")
    
    token = authorization.replace("Bearer ", "")
    user = get_current_user(token, db)
    
    encrypted = encrypt_password(password_data.password, master_password)
    
    new_password = models.Password(
        user_id=user.id,
        site=password_data.site,
        login=password_data.login,
        encrypted_password=encrypted,
        category=password_data.category
    )
    db.add(new_password)
    db.commit()
    db.refresh(new_password)
    
    return schemas.PasswordResponse(
        id=new_password.id,
        site=new_password.site,
        login=new_password.login,
        password=password_data.password,
        category=new_password.category,
        user_id=new_password.user_id,
        created_at=new_password.created_at,
        updated_at=new_password.updated_at
    )

@router.put("/{password_id}", response_model=schemas.PasswordResponse)
async def update_password(
    password_id: int,
    password_data: schemas.PasswordCreate,
    master_password: str,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")
    
    token = authorization.replace("Bearer ", "")
    user = get_current_user(token, db)
    
    password = db.query(models.Password).filter(
        models.Password.id == password_id,
        models.Password.user_id == user.id
    ).first()
    
    if not password:
        raise HTTPException(status_code=404, detail="Пароль не найден")
    
    encrypted = encrypt_password(password_data.password, master_password)
    
    password.site = password_data.site
    password.login = password_data.login
    password.encrypted_password = encrypted
    password.category = password_data.category
    
    db.commit()
    db.refresh(password)
    
    return schemas.PasswordResponse(
        id=password.id,
        site=password.site,
        login=password.login,
        password=password_data.password,
        category=password.category,
        user_id=password.user_id,
        created_at=password.created_at,
        updated_at=password.updated_at
    )

@router.delete("/{password_id}")
async def delete_password(
    password_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")
    
    token = authorization.replace("Bearer ", "")
    user = get_current_user(token, db)
    
    password = db.query(models.Password).filter(
        models.Password.id == password_id,
        models.Password.user_id == user.id
    ).first()
    
    if not password:
        raise HTTPException(status_code=404, detail="Пароль не найден")
    
    db.delete(password)
    db.commit()
    return {"message": "Пароль удален"}
