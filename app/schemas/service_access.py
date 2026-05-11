from pydantic import BaseModel
from datetime import datetime


class GrantAccess(BaseModel):
    user_id: int


class AccessRecord(BaseModel):
    id: int
    user_id: int
    username: str
    email: str
    granted_at: datetime

    class Config:
        from_attributes = True