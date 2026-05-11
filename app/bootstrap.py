"""
Создание первого администратора.
Запуск: python -m app.bootstrap
"""
from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.security import hash_password

def create_admin():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            print("⚠ Admin уже существует")
            return
        admin = User(
            username="admin",
            email="admin@company.com",
            hashed_password=hash_password("Admin12345"),
            is_admin=True,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("✓ Admin создан: admin / Admin12345")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()