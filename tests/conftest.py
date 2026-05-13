"""
conftest.py — налаштування тестового середовища.
Перемикає DATABASE_URL на SQLite in-memory до завантаження будь-якого
модуля app, щоб unit-тести не потребували PostgreSQL.
"""
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

for key in list(sys.modules.keys()):
    if key.startswith("app"):
        del sys.modules[key]
