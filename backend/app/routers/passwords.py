from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
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


def get_authorized_user(authorization: str, db: Session):
    if not authorization:
        raise HTTPException(status_code=401, detail="Токен не предоставлен")
    token = authorization.replace("Bearer ", "")
    return get_current_user(token, db)


def serialize_password(pwd: models.Password, master_password: str) -> schemas.PasswordResponse:
    decrypted = decrypt_password(pwd.encrypted_password, master_password)
    return schemas.PasswordResponse(
        id=pwd.id,
        site=pwd.site,
        login=pwd.login,
        password=decrypted,
        group_id=pwd.group_id,
        group_name=pwd.group.name if pwd.group else None,
        user_id=pwd.user_id,
        sort_order=pwd.sort_order,
        created_at=pwd.created_at,
        updated_at=pwd.updated_at
    )


def get_next_sort_order(db: Session, user_id: int) -> int:
    max_sort = db.query(func.max(models.Password.sort_order)).filter(
        models.Password.user_id == user_id
    ).scalar()
    return (max_sort or 0) + 1


def validate_group_ownership(db: Session, user_id: int, group_id: int | None):
    if group_id is None:
        return None
    group = db.query(models.PasswordGroup).filter(
        models.PasswordGroup.id == group_id,
        models.PasswordGroup.user_id == user_id
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    return group


# ---------------- GROUPS ----------------

@router.get("/groups", response_model=List[schemas.PasswordGroupResponse])
async def get_groups(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)
    groups = db.query(models.PasswordGroup).filter(
        models.PasswordGroup.user_id == user.id
    ).order_by(models.PasswordGroup.name.asc()).all()
    return groups


@router.post("/groups", response_model=schemas.PasswordGroupResponse)
async def create_group(
    group_data: schemas.PasswordGroupCreate,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    existing = db.query(models.PasswordGroup).filter(
        models.PasswordGroup.user_id == user.id,
        func.lower(models.PasswordGroup.name) == group_data.name.strip().lower()
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Группа с таким именем уже существует")

    new_group = models.PasswordGroup(
        user_id=user.id,
        name=group_data.name.strip()
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group


@router.put("/groups/{group_id}", response_model=schemas.PasswordGroupResponse)
async def update_group(
    group_id: int,
    group_data: schemas.PasswordGroupCreate,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    group = db.query(models.PasswordGroup).filter(
        models.PasswordGroup.id == group_id,
        models.PasswordGroup.user_id == user.id
    ).first()

    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    duplicate = db.query(models.PasswordGroup).filter(
        models.PasswordGroup.user_id == user.id,
        func.lower(models.PasswordGroup.name) == group_data.name.strip().lower(),
        models.PasswordGroup.id != group_id
    ).first()

    if duplicate:
        raise HTTPException(status_code=400, detail="Группа с таким именем уже существует")

    group.name = group_data.name.strip()
    db.commit()
    db.refresh(group)
    return group


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    group = db.query(models.PasswordGroup).filter(
        models.PasswordGroup.id == group_id,
        models.PasswordGroup.user_id == user.id
    ).first()

    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    passwords = db.query(models.Password).filter(
        models.Password.group_id == group.id,
        models.Password.user_id == user.id
    ).all()

    for pwd in passwords:
        pwd.group_id = None

    db.delete(group)
    db.commit()
    return {"message": "Группа удалена"}


# ---------------- PASSWORDS ----------------

@router.get("/", response_model=List[schemas.PasswordResponse])
async def get_passwords(
    master_password: str,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    passwords = db.query(models.Password).options(
        joinedload(models.Password.group)
    ).filter(
        models.Password.user_id == user.id
    ).order_by(
        models.Password.sort_order.asc(),
        models.Password.id.asc()
    ).all()

    return [serialize_password(pwd, master_password) for pwd in passwords]


@router.post("/", response_model=schemas.PasswordResponse)
async def add_password(
    password_data: schemas.PasswordCreate,
    master_password: str,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    validate_group_ownership(db, user.id, password_data.group_id)

    encrypted = encrypt_password(password_data.password, master_password)

    new_password = models.Password(
        user_id=user.id,
        site=password_data.site,
        login=password_data.login,
        encrypted_password=encrypted,
        group_id=password_data.group_id,
        sort_order=get_next_sort_order(db, user.id)
    )
    db.add(new_password)
    db.commit()
    db.refresh(new_password)

    loaded_password = db.query(models.Password).options(
        joinedload(models.Password.group)
    ).filter(models.Password.id == new_password.id).first()

    return serialize_password(loaded_password, master_password)


@router.put("/{password_id}", response_model=schemas.PasswordResponse)
async def update_password(
    password_id: int,
    password_data: schemas.PasswordCreate,
    master_password: str,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)
    validate_group_ownership(db, user.id, password_data.group_id)

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
    password.group_id = password_data.group_id

    db.commit()
    db.refresh(password)

    loaded_password = db.query(models.Password).options(
        joinedload(models.Password.group)
    ).filter(models.Password.id == password.id).first()

    return serialize_password(loaded_password, master_password)


@router.delete("/{password_id}")
async def delete_password(
    password_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    password = db.query(models.Password).filter(
        models.Password.id == password_id,
        models.Password.user_id == user.id
    ).first()

    if not password:
        raise HTTPException(status_code=404, detail="Пароль не найден")

    db.delete(password)
    db.commit()
    return {"message": "Пароль удален"}


# ---------------- BULK ACTIONS ----------------

@router.post("/bulk-delete")
async def bulk_delete_passwords(
    payload: schemas.BulkDeleteRequest,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    if not payload.ids:
        raise HTTPException(status_code=400, detail="Не выбраны пароли")

    passwords = db.query(models.Password).filter(
        models.Password.user_id == user.id,
        models.Password.id.in_(payload.ids)
    ).all()

    found_ids = {p.id for p in passwords}
    missing = [pid for pid in payload.ids if pid not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Часть паролей не найдена: {missing}")

    deleted_count = len(passwords)
    for pwd in passwords:
        db.delete(pwd)

    db.commit()
    return {"message": f"Удалено {deleted_count} паролей", "deleted_count": deleted_count}


@router.post("/bulk-move")
async def bulk_move_passwords(
    payload: schemas.BulkMoveRequest,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    if not payload.ids:
        raise HTTPException(status_code=400, detail="Не выбраны пароли")

    validate_group_ownership(db, user.id, payload.group_id)

    passwords = db.query(models.Password).filter(
        models.Password.user_id == user.id,
        models.Password.id.in_(payload.ids)
    ).all()

    found_ids = {p.id for p in passwords}
    missing = [pid for pid in payload.ids if pid not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Часть паролей не найдена: {missing}")

    for pwd in passwords:
        pwd.group_id = payload.group_id

    db.commit()
    return {"message": f"Перемещено {len(passwords)} паролей", "moved_count": len(passwords)}


@router.post("/bulk-share", response_model=schemas.BulkShareResponse)
async def bulk_share_passwords(
    payload: schemas.BulkShareRequest,
    master_password: str,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    if not payload.ids:
        raise HTTPException(status_code=400, detail="Не выбраны пароли")

    passwords = db.query(models.Password).options(
        joinedload(models.Password.group)
    ).filter(
        models.Password.user_id == user.id,
        models.Password.id.in_(payload.ids)
    ).order_by(models.Password.sort_order.asc(), models.Password.id.asc()).all()

    found_ids = {p.id for p in passwords}
    missing = [pid for pid in payload.ids if pid not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Часть паролей не найдена: {missing}")

    items = []
    lines = []
    for pwd in passwords:
        decrypted = decrypt_password(pwd.encrypted_password, master_password)
        group_name = pwd.group.name if pwd.group else "Без группы"
        items.append(
            schemas.ShareItemResponse(
                id=pwd.id,
                site=pwd.site,
                login=pwd.login,
                password=decrypted,
                group_name=group_name
            )
        )
        lines.append(
            f"Сайт: {pwd.site}\nЛогин: {pwd.login}\nПароль: {decrypted}\nГруппа: {group_name}"
        )

    return schemas.BulkShareResponse(
        items=items,
        text="\n\n---\n\n".join(lines)
    )


@router.post("/reorder")
async def reorder_passwords(
    payload: schemas.ReorderPasswordsRequest,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user = get_authorized_user(authorization, db)

    if not payload.ordered_ids:
        raise HTTPException(status_code=400, detail="Не передан порядок паролей")

    passwords = db.query(models.Password).filter(
        models.Password.user_id == user.id
    ).all()

    user_ids = {p.id for p in passwords}
    incoming_ids = payload.ordered_ids

    if set(incoming_ids) != user_ids:
        raise HTTPException(
            status_code=400,
            detail="Список ordered_ids должен содержать все id паролей пользователя ровно один раз"
        )

    order_map = {pwd_id: index + 1 for index, pwd_id in enumerate(incoming_ids)}

    for pwd in passwords:
        pwd.sort_order = order_map[pwd.id]

    db.commit()
    return {"message": "Порядок обновлен"}