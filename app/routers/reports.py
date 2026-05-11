from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.service import Service, ServiceStatus
from app.models.resource import Resource
from app.models.endpoint import Endpoint
from app.models.ssl_certificate import SSLCertificate
from app.dependencies import require_admin

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/global")
def global_infra_report(db: Session = Depends(get_db),
                        admin: User = Depends(require_admin)):
    """Admin Zone: View Global Infra Report"""
    total_services = db.query(func.count(Service.id)).scalar()
    by_status = dict(db.query(Service.status, func.count()).group_by(Service.status).all())

    total_resources = db.query(func.count(Resource.id)).scalar()
    attached = db.query(func.count(Resource.id)).filter(Resource.is_attached.is_(True)).scalar()
    total_cpu = db.query(func.coalesce(func.sum(Resource.cpu_cores), 0)).scalar()
    total_ram = db.query(func.coalesce(func.sum(Resource.ram_gb), 0)).scalar()
    total_disk = db.query(func.coalesce(func.sum(Resource.disk_gb), 0)).scalar()

    total_endpoints = db.query(func.count(Endpoint.id)).scalar()
    total_ssl = db.query(func.count(SSLCertificate.id)).scalar()

    return {
        "services": {
            "total": total_services,
            "by_status": {str(k.value if hasattr(k, "value") else k): v for k, v in by_status.items()},
        },
        "resources": {
            "total": total_resources,
            "attached": attached,
            "free": total_resources - attached,
            "capacity": {"cpu_cores": total_cpu, "ram_gb": total_ram, "disk_gb": total_disk},
        },
        "network": {
            "endpoints": total_endpoints,
            "ssl_certificates": total_ssl,
        },
    }