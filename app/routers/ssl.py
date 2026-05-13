from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.endpoint import Endpoint
from app.models.service import Service
from app.models.ssl_certificate import SSLCertificate
from app.schemas.ssl_certificate import SSLCertificateCreate, SSLCertificateOut
from app.dependencies import get_current_user, require_admin, get_accessible_service_ids

router = APIRouter(prefix="/ssl", tags=["SSL"])


def _to_out(cert: SSLCertificate) -> dict:
    now = datetime.now(timezone.utc)
    valid_to = (
        cert.valid_to
        if cert.valid_to.tzinfo
        else cert.valid_to.replace(tzinfo=timezone.utc)
    )
    delta = (valid_to - now).days
    endpoint = cert.endpoint
    return {
        "id": cert.id,
        "issuer": cert.issuer,
        "valid_from": cert.valid_from,
        "valid_to": cert.valid_to,
        "endpoint_id": cert.endpoint_id,
        "endpoint_domain": endpoint.domain if endpoint else None,
        "service_name": endpoint.service.name if endpoint and endpoint.service else None,
        "days_until_expiry": delta,
        "is_expired": delta < 0,
    }


@router.post("/", response_model=SSLCertificateOut, status_code=201)
def attach_ssl(
    payload: SSLCertificateCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin Zone: Attach SSL Certificate."""
    endpoint = (
        db.query(Endpoint)
        .options(joinedload(Endpoint.ssl_certificate), joinedload(Endpoint.service))
        .filter(Endpoint.id == payload.endpoint_id)
        .first()
    )
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")
    if endpoint.ssl_certificate:
        raise HTTPException(409, "Endpoint already has an SSL certificate")

    now = datetime.now(timezone.utc)
    valid_to = (
        payload.valid_to
        if payload.valid_to.tzinfo
        else payload.valid_to.replace(tzinfo=timezone.utc)
    )
    if valid_to < now:
        raise HTTPException(400, "Certificate is already expired")

    cert = SSLCertificate(**payload.model_dump())
    db.add(cert)
    db.commit()
    db.refresh(cert)
    # підвантажуємо зв'язки для серіалізації
    db.refresh(cert)
    return _to_out(cert)


@router.delete("/{cert_id}", status_code=204)
def revoke_ssl(
    cert_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Відкликати / видалити SSL-сертифікат."""
    cert = db.query(SSLCertificate).get(cert_id)
    if not cert:
        raise HTTPException(404, "SSL certificate not found")
    db.delete(cert)
    db.commit()


@router.get("/expiry-check", response_model=List[SSLCertificateOut])
def check_ssl_expiry(
    days: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """User Zone: Check SSL Expiry (extend: View Endpoints & SSL)."""
    q = (
        db.query(SSLCertificate)
        .options(joinedload(SSLCertificate.endpoint).joinedload(Endpoint.service))
        .join(Endpoint)
        .join(Service)
    )
    if not user.is_admin:
        ids = get_accessible_service_ids(db, user)
        if not ids:
            return []
        q = q.filter(Service.id.in_(ids))
    certs = q.all()
    return [_to_out(c) for c in certs if _to_out(c)["days_until_expiry"] <= days]
