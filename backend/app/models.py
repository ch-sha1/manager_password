from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True)
    master_password_hash = Column(String(255))
    twofa_secret = Column(String(255), nullable=True)
    twofa_enabled = Column(Boolean, default=False)
    twofa_email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    passwords = relationship("Password", back_populates="user", cascade="all, delete-orphan")
    groups = relationship("PasswordGroup", back_populates="user", cascade="all, delete-orphan")


class PasswordGroup(Base):
    __tablename__ = "password_groups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="groups")
    passwords = relationship("Password", back_populates="group")


class Password(Base):
    __tablename__ = "passwords"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    site = Column(String(255), nullable=False)
    login = Column(String(255), nullable=False)
    encrypted_password = Column(Text, nullable=False)
    group_id = Column(Integer, ForeignKey("password_groups.id", ondelete="SET NULL"), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="passwords")
    group = relationship("PasswordGroup", back_populates="passwords")