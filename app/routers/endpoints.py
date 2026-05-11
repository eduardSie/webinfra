from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.service import Service
from app.models.endpoint import Endpoint
from app.schemas.endpoint import EndpointCreate, EndpointOut
from app.dependencies import get_current_user, require_admin
from app.dependencies import get_current_user, require_admin, get_accessible_service_ids

router = APIRouter(prefix="/endpoints", tags=["Endpoints"])


def _serialize(ep: Endpoint) -> dict:
    return {
        "id": ep.id,
        "domain": ep.domain,
        "port": ep.port,
        "service_id": ep.service_id,
        "service_name": ep.service.name if ep.service else None,
        "created_at": ep.created_at,
    }


@router.get("/", response_model=List[EndpointOut])
def view_endpoints(db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    q = db.query(Endpoint).options(joinedload(Endpoint.service))
    if not user.is_admin:
        ids = get_accessible_service_ids(db, user)
        if not ids:
            return []
        q = q.filter(Endpoint.service_id.in_(ids))
    return [_serialize(e) for e in q.all()]


@router.post("/", response_model=EndpointOut, status_code=201)
def configure_endpoint(payload: EndpointCreate,
                       db: Session = Depends(get_db),
                       admin: User = Depends(require_admin)):
    """Admin Zone: Configure Endpoint (Domain)"""
    service = db.query(Service).get(payload.service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    if db.query(Endpoint).filter(Endpoint.domain == payload.domain).first():
        raise HTTPException(409, "Domain already registered")
    if payload.port == 80:
        raise HTTPException(400, "Plain HTTP (port 80) is not allowed. Use HTTPS.")

    endpoint = Endpoint(**payload.model_dump())
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return _serialize(endpoint)