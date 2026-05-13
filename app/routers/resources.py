from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
import ipaddress

from app.database import get_db
from app.models.user import User
from app.models.resource import Resource
from app.models.service import Service
from app.schemas.resource import ResourceCreate, ResourceOut, ResourceAllocate
from app.dependencies import get_current_user, require_admin, get_accessible_service_ids

router = APIRouter(prefix="/resources", tags=["Resources"])


def _serialize(r: Resource) -> dict:
    return {
        "id": r.id,
        "hostname": r.hostname,
        "ip_address": r.ip_address,
        "cpu_cores": r.cpu_cores,
        "ram_gb": r.ram_gb,
        "disk_gb": r.disk_gb,
        "is_attached": r.is_attached,
        "service_id": r.service_id,
        "service_name": r.service.name if r.service else None,
        "created_at": r.created_at,
    }


def _validate_network_config(ip: str, db: Session, exclude_id: int | None = None):
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        raise HTTPException(400, "Invalid IP address")

    if addr.is_loopback or addr.is_multicast or addr.is_reserved or addr.is_unspecified:
        raise HTTPException(400, "IP in forbidden range (loopback / multicast / reserved / unspecified)")

    q = db.query(Resource).filter(Resource.ip_address == ip)
    if exclude_id:
        q = q.filter(Resource.id != exclude_id)
    if q.first():
        raise HTTPException(409, "IP address already used by another resource")


@router.get("/status", response_model=List[ResourceOut])
def view_resource_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Resource).options(joinedload(Resource.service))
    if not user.is_admin:
        ids = get_accessible_service_ids(db, user)
        if not ids:
            return []
        q = q.filter(Resource.service_id.in_(ids))
    return [_serialize(r) for r in q.all()]


@router.post("/", response_model=ResourceOut, status_code=201)
def create_resource(
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    _validate_network_config(payload.ip_address, db)
    res = Resource(**payload.model_dump())
    db.add(res)
    db.commit()
    db.refresh(res)
    return _serialize(res)


@router.post("/{resource_id}/allocate", response_model=ResourceOut)
def allocate_resource(
    resource_id: int,
    payload: ResourceAllocate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin Zone: Allocate Resources (Servers) — включає Validate Network Config."""
    res = db.query(Resource).get(resource_id)
    if not res:
        raise HTTPException(404, "Resource not found")
    if res.is_attached:
        raise HTTPException(400, "Resource already attached to a service")

    service = db.query(Service).get(payload.service_id)
    if not service:
        raise HTTPException(404, "Target service not found")

    _validate_network_config(res.ip_address, db, exclude_id=res.id)

    if service.status.value == "deprecated":
        raise HTTPException(400, "Cannot allocate resource to deprecated service")

    res.is_attached = True
    res.service_id = service.id
    db.commit()
    db.refresh(res)
    return _serialize(res)


@router.post("/{resource_id}/detach", response_model=ResourceOut)
def detach_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin Zone: Detach Resources."""
    res = db.query(Resource).get(resource_id)
    if not res:
        raise HTTPException(404, "Resource not found")
    if not res.is_attached:
        raise HTTPException(400, "Resource is not attached")
    res.is_attached = False
    res.service_id = None
    db.commit()
    db.refresh(res)
    return _serialize(res)


@router.delete("/{resource_id}", status_code=204)
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Видалити ресурс (тільки якщо не прив'язаний до сервісу)."""
    res = db.query(Resource).get(resource_id)
    if not res:
        raise HTTPException(404, "Resource not found")
    if res.is_attached:
        raise HTTPException(400, "Detach resource from service before deletion")
    db.delete(res)
    db.commit()
