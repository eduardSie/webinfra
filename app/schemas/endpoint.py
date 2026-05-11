from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
import re


class EndpointBase(BaseModel):
    domain: str = Field(..., max_length=255)
    port: int = Field(443, ge=1, le=65535)

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        v = v.strip().lower()
        pattern = r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$"
        if not re.match(pattern, v):
            raise ValueError("Invalid domain format")
        return v


class EndpointCreate(EndpointBase):
    service_id: int


class EndpointOut(EndpointBase):
    id: int
    service_id: int
    service_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True