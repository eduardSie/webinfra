from pydantic import BaseModel, Field, field_validator, IPvAnyAddress
from typing import Optional
from datetime import datetime


class ResourceBase(BaseModel):
    hostname: str = Field(..., min_length=2, max_length=128)
    ip_address: str
    cpu_cores: int = Field(..., gt=0, le=256)
    ram_gb: int = Field(..., gt=0, le=4096)
    disk_gb: int = Field(..., gt=0, le=1_000_000)

    @field_validator("ip_address")
    @classmethod
    def validate_ip(cls, v: str) -> str:
        IPvAnyAddress(v)
        return v


class ResourceCreate(ResourceBase):
    pass


class ResourceAllocate(BaseModel):
    service_id: int


class ResourceOut(ResourceBase):
    id: int
    is_attached: bool
    service_id: Optional[int]
    service_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True