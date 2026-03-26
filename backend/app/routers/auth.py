from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.auth import verify_master_password, hash_master_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register")
async def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    
    new_user = models.User(
        username=user_data.username,
        master_password_hash=hash_master_password(user_data.master_password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "Пользователь создан", "user_id": new_user.id}

@router.post("/login")
async def login(login_data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == "admin").first()
    
    if not user:
        user = models.User(
            username="admin",
            master_password_hash=hash_master_password("admin")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    if not verify_master_password(login_data.master_password, user.master_password_hash):
        raise HTTPException(status_code=401, detail="Неверный мастер-пароль")
    
    if user.twofa_enabled:
        return {"requires_2fa": True, "token": None}
    
    token = create_access_token(data={"user_id": user.id})
    return {"requires_2fa": False, "token": token}
