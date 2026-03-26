from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
import hashlib
import bcrypt
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import base64

load_dotenv()

# Хеширование мастер-пароля (bcrypt)
def hash_master_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_master_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

# AES-256 шифрование для сохраненных паролей
def get_encryption_key(master_password: str) -> bytes:
    """Генерирует ключ AES-256 из мастер-пароля"""
    key = hashlib.sha256(master_password.encode()).digest()
    return base64.urlsafe_b64encode(key)

def encrypt_password(password: str, master_password: str) -> str:
    key = hashlib.sha256(master_password.encode()).digest()
    fernet = Fernet(base64.urlsafe_b64encode(key))
    return fernet.encrypt(password.encode()).decode()

def decrypt_password(encrypted: str, master_password: str) -> str:
    """Расшифровывает пароль AES-256"""
    key = get_encryption_key(master_password)
    fernet = Fernet(key)
    return fernet.decrypt(encrypted.encode()).decode()

# JWT для сессий
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
