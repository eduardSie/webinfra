from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.service import Service, ServiceStatus
from app.models.service_access import ServiceAccess
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceOut
from app.schemas.service_access import GrantAccess, AccessRecord
from app.dependencies import (
    get_current_user, require_admin,
    user_can_access_service, get_accessible_service_ids,
)

router = APIRouter(prefix="/services", tags=["Services"])


@router.get("/my", response_model=List[ServiceOut])
def my_services(db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    """User Zone: видит только сервисы, к которым у него есть доступ."""
    if user.is_admin:
        return db.query(Service).all()
    ids = get_accessible_service_ids(db, user)
    if not ids:
        return []
    return db.query(Service).filter(Service.id.in_(ids)).all()


@router.get("/{service_id}", response_model=ServiceOut)
def service_details(service_id: int,
                    db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    service = db.query(Service).get(service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    if not user_can_access_service(db, user, service_id):
        raise HTTPException(403, "No access to this service")
    return service


@router.post("/", response_model=ServiceOut, status_code=201)
def register_service(payload: ServiceCreate,
                     db: Session = Depends(get_db),
                     admin: User = Depends(require_admin)):
    if db.query(Service).filter(Service.name.ilike(payload.name)).first():
        raise HTTPException(409, "Service with this name already exists")
    if payload.status == ServiceStatus.DEPRECATED:
        raise HTTPException(400, "Cannot register a service as DEPRECATED")
    service = Service(**payload.model_dump(), owner_id=admin.id)
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.patch("/{service_id}", response_model=ServiceOut)
def edit_service(service_id: int,
                 payload: ServiceUpdate,
                 db: Session = Depends(get_db),
                 admin: User = Depends(require_admin)):
    service = db.query(Service).get(service_id)
    if not service:
        raise HTTPException(404, "Service not found")

    if payload.name and payload.name != service.name:
        if db.query(Service).filter(Service.name.ilike(payload.name)).first():
            raise HTTPException(409, "Name already in use")

    if payload.status:
        if service.status == ServiceStatus.DEPRECATED and payload.status != ServiceStatus.DEPRECATED:
            raise HTTPException(400, "Cannot revive a DEPRECATED service")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, val)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=204)
def delete_service(service_id: int,
                   db: Session = Depends(get_db),
                   admin: User = Depends(require_admin)):
    service = db.query(Service).get(service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    if any(r.is_attached for r in service.resources):
        raise HTTPException(400, "Detach all resources before deletion")
    if service.status == ServiceStatus.ACTIVE:
        raise HTTPException(400, "Set status to INACTIVE before deletion")
    db.delete(service)
    db.commit()


# ---------- Управление доступом ----------

@router.get("/{service_id}/access", response_model=List[AccessRecord])
def list_access(service_id: int,
                db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    """Список юзеров, имеющих доступ к сервису."""
    if not db.query(Service).get(service_id):
        raise HTTPException(404, "Service not found")
    rows = (
        db.query(ServiceAccess, User)
        .join(User, ServiceAccess.user_id == User.id)
        .filter(ServiceAccess.service_id == service_id)
        .all()
    )
    return [
        {
            "id": acc.id,
            "user_id": u.id,
            "username": u.username,
            "email": u.email,
            "granted_at": acc.granted_at,
        }
        for acc, u in rows
    ]


@router.post("/{service_id}/access", response_model=AccessRecord, status_code=201)
def grant_access(service_id: int,
                 payload: GrantAccess,
                 db: Session = Depends(get_db),
                 admin: User = Depends(require_admin)):
    """Выдать доступ пользователю к сервису."""
    service = db.query(Service).get(service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    user = db.query(User).get(payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_admin:
        raise HTTPException(400, "Admins already have access to all services")
    if not user.is_active:
        raise HTTPException(400, "Cannot grant access to deactivated user")

    existing = db.query(ServiceAccess).filter_by(
        user_id=user.id, service_id=service_id
    ).first()
    if existing:
        raise HTTPException(409, "User already has access to this service")

    record = ServiceAccess(user_id=user.id, service_id=service_id, granted_by=admin.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "granted_at": record.granted_at,
    }


@router.delete("/{service_id}/access/{user_id}", status_code=204)
def revoke_access(service_id: int,
                  user_id: int,
                  db: Session = Depends(get_db),
                  admin: User = Depends(require_admin)):
    record = db.query(ServiceAccess).filter_by(
        service_id=service_id, user_id=user_id
    ).first()
    if not record:
        raise HTTPException(404, "Access record not found")
    db.delete(record)
    db.commit()