from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from app.models.service import ServiceStatus

class ServiceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    description: Optional[str] = Field(None, max_length=2000)
    status: ServiceStatus = ServiceStatus.ACTIVE

    @field_validator("name")
    @classmethod
    def name_rules(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Service name cannot be empty")
        return v

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=128)
    description: Optional[str] = None
    status: Optional[ServiceStatus] = None

class ServiceOut(ServiceBase):
    id: int
    owner_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True