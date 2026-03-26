from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import string

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Модели данных
class LoginRequest(BaseModel):
    master_password: str

class Verify2FARequest(BaseModel):
    master_password: str
    two_factor_code: str

class PasswordRequest(BaseModel):
    site: str
    login: str
    password: str
    category: str = ""

class GeneratePasswordRequest(BaseModel):
    length: int = 12
    use_digits: bool = True
    use_uppercase: bool = True
    use_lowercase: bool = True
    use_special: bool = False

# Простая база пользователей
users = {
    "admin": {
        "master_password": "admin",
        "requires_2fa": False
    },
    "user": {
        "master_password": "123",
        "requires_2fa": False
    },
    "test": {
        "master_password": "test",
        "requires_2fa": False
    }
}

# Тестовые данные паролей
test_passwords = [
    {"id": 1, "site": "google.com", "login": "user@gmail.com", "password": "Test123!", "category": "Email"},
    {"id": 2, "site": "github.com", "login": "username", "password": "GitHubPass123", "category": "Development"},
    {"id": 3, "site": "facebook.com", "login": "user@facebook.com", "password": "FbPass456", "category": "Social"},
]

next_id = 4

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    # Проверяем пароль
    for user_data in users.values():
        if user_data["master_password"] == request.master_password:
            return {
                "requires_2fa": user_data["requires_2fa"], 
                "token": "test-token-123"
            }
    
    # Пароль не найден
    raise HTTPException(status_code=401, detail="Неверный мастер-пароль")

@app.post("/api/auth/verify-2fa")
async def verify_2fa(request: Verify2FARequest):
    # Проверяем пароль
    for user_data in users.values():
        if user_data["master_password"] == request.master_password:
            return {"token": "test-token-123"}
    
    raise HTTPException(status_code=401, detail="Неверный мастер-пароль или код 2FA")

@app.get("/api/passwords")
async def get_passwords():
    return test_passwords

@app.post("/api/passwords")
async def add_password(request: PasswordRequest):
    global next_id
    new_password = {
        "id": next_id,
        "site": request.site,
        "login": request.login,
        "password": request.password,
        "category": request.category
    }
    test_passwords.append(new_password)
    next_id += 1
    return new_password

@app.delete("/api/passwords/{password_id}")
async def delete_password(password_id: int):
    global test_passwords
    test_passwords = [p for p in test_passwords if p["id"] != password_id]
    return {"message": "Password deleted"}

@app.post("/api/generate-password")
async def generate_password(request: GeneratePasswordRequest):
    chars = ""
    if request.use_lowercase:
        chars += string.ascii_lowercase
    if request.use_uppercase:
        chars += string.ascii_uppercase
    if request.use_digits:
        chars += string.digits
    if request.use_special:
        chars += "!@#$%^&*"
    
    if not chars:
        chars = string.ascii_lowercase
    
    password = ''.join(random.choice(chars) for _ in range(request.length))
    return {"password": password}

@app.get("/")
async def root():
    return {"message": "Password Manager API is running"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)