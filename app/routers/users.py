from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, Token
from app.security import hash_password, verify_password, create_access_token
from app.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/login", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Єдиний публічний ендпоінт. Самостійна реєстрація заборонена."""
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account deactivated")
    token = create_access_token({"sub": str(user.id), "admin": user.is_admin})
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return db.query(User).all()


@router.post("/", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Тільки адмін може створювати користувачів."""
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(409, "Username already taken")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Email already registered")

    if payload.is_admin and not payload.email.endswith(("@company.com", "@corp.local")):
        raise HTTPException(400, "Admins must use corporate email domain")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_admin=payload.is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot deactivate yourself")

    # Guard: не можна деактивувати останнього активного адміна
    if user.is_admin:
        active_admins = (
            db.query(User)
            .filter(User.is_admin.is_(True), User.is_active.is_(True), User.id != user.id)
            .count()
        )
        if active_admins == 0:
            raise HTTPException(400, "Cannot deactivate the last active admin")

    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/activate", response_model=UserOut)
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Реактивація деактивованого користувача."""
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_active:
        raise HTTPException(400, "User is already active")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user
