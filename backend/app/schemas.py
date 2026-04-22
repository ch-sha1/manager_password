from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    master_password: str


class UserResponse(UserBase):
    id: int
    twofa_enabled: bool
    twofa_email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class PasswordGroupCreate(PasswordGroupBase):
    pass


class PasswordGroupResponse(PasswordGroupBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordBase(BaseModel):
    site: str
    login: str
    password: str
    group_id: Optional[int] = None


class PasswordCreate(PasswordBase):
    pass


class PasswordResponse(PasswordBase):
    id: int
    user_id: int
    group_name: Optional[str] = None
    sort_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BulkDeleteRequest(BaseModel):
    ids: List[int]


class BulkMoveRequest(BaseModel):
    ids: List[int]
    group_id: Optional[int] = None


class BulkShareRequest(BaseModel):
    ids: List[int]


class ReorderPasswordsRequest(BaseModel):
    ordered_ids: List[int]


class ShareItemResponse(BaseModel):
    id: int
    site: str
    login: str
    password: str
    group_name: Optional[str] = None


class BulkShareResponse(BaseModel):
    items: List[ShareItemResponse]
    text: str


class LoginRequest(BaseModel):
    master_password: str


class LoginResponse(BaseModel):
    requires_2fa: bool
    token: Optional[str] = None


class Verify2FARequest(BaseModel):
    master_password: str
    two_factor_code: str


class AuthSettingsResponse(BaseModel):
    twoFAEnabled: bool
    twoFAEmail: Optional[str] = None


class AuthSettingsUpdate(BaseModel):
    twoFAEnabled: bool
    twoFAEmail: Optional[str] = None


class ChangeMasterPasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class ChangeMasterPasswordResponse(BaseModel):
    message: str


class GeneratePasswordRequest(BaseModel):
    length: int = 12
    use_digits: bool = True
    use_uppercase: bool = True
    use_lowercase: bool = True
    use_special: bool = False


class GeneratePasswordResponse(BaseModel):
    password: str