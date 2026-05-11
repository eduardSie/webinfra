from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    services = relationship("Service", back_populates="owner", cascade="all, delete-orphan",
                            foreign_keys="Service.owner_id")
    accessible_services = relationship(
        "Service",
        secondary="service_access",
        primaryjoin="User.id == ServiceAccess.user_id",
        secondaryjoin="Service.id == ServiceAccess.service_id",
        viewonly=True,
    )