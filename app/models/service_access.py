from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint, func
from app.database import Base


class ServiceAccess(Base):
    __tablename__ = "service_access"
    __table_args__ = (
        UniqueConstraint("user_id", "service_id", name="uq_user_service"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    granted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)