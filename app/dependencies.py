from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError
from app.database import get_db
from app.models.user import User
from app.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")

def get_current_user(token: str = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)) -> User:
    cred_exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    try:
        payload = decode_token(token)
        user_id: int = payload.get("sub")
        if user_id is None:
            raise cred_exc
    except JWTError:
        raise cred_exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise cred_exc
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return current_user

def user_can_access_service(db: Session, user: User, service_id: int) -> bool:
    """True если admin, владелец или есть запись в service_access."""
    if user.is_admin:
        return True
    svc = db.query(Service).get(service_id)
    if not svc:
        return False
    if svc.owner_id == user.id:
        return True
    return db.query(ServiceAccess).filter_by(
        user_id=user.id, service_id=service_id
    ).first() is not None

def get_accessible_service_ids(db: Session, user: User) -> list[int]:
    """Все ID сервисов, к которым у юзера есть доступ (для фильтрации списков)."""
    if user.is_admin:
        return [s.id for s in db.query(Service.id).all()]

    owned = db.query(Service.id).filter(Service.owner_id == user.id).all()
    granted = db.query(ServiceAccess.service_id).filter_by(user_id=user.id).all()
    return list({row[0] for row in owned} | {row[0] for row in granted})
