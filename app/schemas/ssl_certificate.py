from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Optional


class SSLCertificateCreate(BaseModel):
    issuer: str = Field(..., min_length=2, max_length=255)
    valid_from: datetime
    valid_to: datetime
    endpoint_id: int

    @model_validator(mode="after")
    def check_dates(self):
        if self.valid_to <= self.valid_from:
            raise ValueError("valid_to must be after valid_from")
        return self


class SSLCertificateOut(BaseModel):
    id: int
    issuer: str
    valid_from: datetime
    valid_to: datetime
    endpoint_id: int
    endpoint_domain: Optional[str] = None
    service_name: Optional[str] = None
    days_until_expiry: int
    is_expired: bool

    class Config:
        from_attributes = True