from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    master_password: str

class UserResponse(UserBase):
    id: int
    twofa_enabled: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class PasswordBase(BaseModel):
    site: str
    login: str
    password: str
    category: Optional[str] = None

class PasswordCreate(PasswordBase):
    pass

class PasswordResponse(PasswordBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    master_password: str

class LoginResponse(BaseModel):
    requires_2fa: bool
    token: Optional[str] = None

class Verify2FARequest(BaseModel):
    master_password: str
    two_factor_code: str

class GeneratePasswordRequest(BaseModel):
    length: int = 12
    use_digits: bool = True
    use_uppercase: bool = True
    use_lowercase: bool = True
    use_special: bool = False

class GeneratePasswordResponse(BaseModel):
    password: str
