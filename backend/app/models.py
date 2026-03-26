from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True)
    master_password_hash = Column(String(255))  # Хеш мастер-пароля
    twofa_secret = Column(String(255), nullable=True)
    twofa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    passwords = relationship("Password", back_populates="user", cascade="all, delete-orphan")

class Password(Base):
    __tablename__ = "passwords"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    site = Column(String(255))
    login = Column(String(255))
    encrypted_password = Column(Text)  # Зашифрован AES-256
    category = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="passwords")
