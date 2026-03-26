from fastapi import APIRouter
import random
import string
from app import schemas

router = APIRouter(prefix="/api/generate-password", tags=["generator"])

@router.post("/", response_model=schemas.GeneratePasswordResponse)
async def generate_password(options: schemas.GeneratePasswordRequest):
    chars = ""
    if options.use_lowercase:
        chars += string.ascii_lowercase
    if options.use_uppercase:
        chars += string.ascii_uppercase
    if options.use_digits:
        chars += string.digits
    if options.use_special:
        chars += "!@#$%^&*()_+-=[]{}|;:,.<>?"
    
    if not chars:
        chars = string.ascii_lowercase
    
    password = ''.join(random.choice(chars) for _ in range(options.length))
    return {"password": password}
