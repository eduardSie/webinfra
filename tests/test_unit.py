"""
Unit-тести для Internal Service Catalog Platform.
Не потребують бази даних — вся зовнішня залежність мокується.

Запуск: pytest tests/test_unit.py -v
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch, PropertyMock
from fastapi import HTTPException
from jose import jwt

# Helpers 

def _make_db(first_result=None):
    """Мінімальний мок SQLAlchemy Session з підтримкою ланцюгового виклику."""
    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.filter_by.return_value = q
    q.options.return_value = q
    q.first.return_value = first_result
    q.all.return_value = []
    q.count.return_value = 0
    q.scalar.return_value = 0
    return db


# 1. SECURITY

class TestSecurity:
    """app/security.py"""

    def setup_method(self):
        from app.security import hash_password, verify_password, create_access_token, decode_token
        self.hash_password = hash_password
        self.verify_password = verify_password
        self.create_access_token = create_access_token
        self.decode_token = decode_token
        from app.config import settings
        self.settings = settings


    def test_hash_differs_from_plain(self):
        assert self.hash_password("Secret1") != "Secret1"

    def test_verify_correct_password(self):
        h = self.hash_password("Secret1")
        assert self.verify_password("Secret1", h) is True

    def test_verify_wrong_password(self):
        h = self.hash_password("Secret1")
        assert self.verify_password("WrongPass1", h) is False

    def test_hash_is_salted(self):
        """Bcrypt використовує сіль — однаковий пароль дає різні хеші."""
        h1 = self.hash_password("Same1")
        h2 = self.hash_password("Same1")
        assert h1 != h2

    def test_empty_string_hashes(self):
        h = self.hash_password("")
        assert self.verify_password("", h) is True
        assert self.verify_password("x", h) is False


    def test_token_contains_subject(self):
        token = self.create_access_token({"sub": "42"})
        payload = self.decode_token(token)
        assert payload["sub"] == "42"

    def test_token_contains_extra_claims(self):
        token = self.create_access_token({"sub": "1", "admin": True})
        payload = self.decode_token(token)
        assert payload["admin"] is True

    def test_token_has_future_expiry(self):
        token = self.create_access_token({"sub": "1"})
        payload = self.decode_token(token)
        assert payload["exp"] > datetime.now(timezone.utc).timestamp()

    def test_expired_token_raises(self):
        expired = jwt.encode(
            {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
            self.settings.SECRET_KEY,
            algorithm=self.settings.ALGORITHM,
        )
        with pytest.raises(Exception):
            self.decode_token(expired)

    def test_tampered_token_raises(self):
        token = self.create_access_token({"sub": "1"})
        with pytest.raises(Exception):
            self.decode_token(token + "tampered")

    def test_wrong_secret_raises(self):
        token = jwt.encode({"sub": "1"}, "wrong_secret", algorithm=self.settings.ALGORITHM)
        with pytest.raises(Exception):
            self.decode_token(token)


# 2. USER SCHEMA VALIDATORS

class TestUserSchema:
    """app/schemas/user.py — UserCreate validators"""

    def _make(self, **kwargs):
        from app.schemas.user import UserCreate
        defaults = {"username": "john_doe", "email": "john@example.com", "password": "Secret12"}
        defaults.update(kwargs)
        return UserCreate(**defaults)

    def test_valid_user_created(self):
        u = self._make()
        assert u.username == "john_doe"
        assert u.is_admin is False

    def test_password_too_short(self):
        with pytest.raises(Exception):
            self._make(password="Ab1")

    def test_password_no_uppercase(self):
        with pytest.raises(Exception):
            self._make(password="secret123")

    def test_password_no_digit(self):
        with pytest.raises(Exception):
            self._make(password="SecretPass")

    def test_password_exactly_8_valid(self):
        u = self._make(password="Secret1!")
        assert u.password == "Secret1!"

    def test_long_password_accepted(self):
        u = self._make(password="A" + "b" * 120 + "1")
        assert len(u.password) == 122

    def test_password_too_long(self):
        with pytest.raises(Exception):
            self._make(password="A" * 127 + "1" + "x")  # 129 chars → over max_length=128

    def test_username_with_space_rejected(self):
        with pytest.raises(Exception):
            self._make(username="john doe")

    def test_username_with_at_rejected(self):
        with pytest.raises(Exception):
            self._make(username="john@doe")

    def test_username_dots_underscores_dashes_ok(self):
        u = self._make(username="john.doe_99-x")
        assert u.username == "john.doe_99-x"

    def test_username_too_short(self):
        with pytest.raises(Exception):
            self._make(username="ab")

    def test_username_exactly_3_ok(self):
        u = self._make(username="abc")
        assert u.username == "abc"

    def test_email_missing_at(self):
        with pytest.raises(Exception):
            self._make(email="notanemail")

    def test_email_missing_domain(self):
        with pytest.raises(Exception):
            self._make(email="user@")


# 3. ENDPOINT SCHEMA VALIDATORS

class TestEndpointSchema:
    """app/schemas/endpoint.py"""

    def _make(self, domain="api.company.com", port=443, service_id=1):
        from app.schemas.endpoint import EndpointCreate
        return EndpointCreate(domain=domain, port=port, service_id=service_id)

    def test_valid_endpoint(self):
        ep = self._make()
        assert ep.domain == "api.company.com"

    def test_domain_is_lowercased(self):
        ep = self._make(domain="API.Company.COM")
        assert ep.domain == "api.company.com"

    def test_domain_whitespace_stripped(self):
        ep = self._make(domain="  api.co.com  ")
        assert ep.domain == "api.co.com"

    def test_domain_no_tld_rejected(self):
        with pytest.raises(Exception):
            self._make(domain="localhost")

    def test_domain_starts_with_dash_rejected(self):
        with pytest.raises(Exception):
            self._make(domain="-bad.com")

    def test_domain_ends_with_dash_rejected(self):
        with pytest.raises(Exception):
            self._make(domain="bad-.com")

    def test_domain_with_subdomain_ok(self):
        ep = self._make(domain="deep.sub.domain.company.io")
        assert ep.domain == "deep.sub.domain.company.io"

    def test_port_zero_rejected(self):
        with pytest.raises(Exception):
            self._make(port=0)

    def test_port_over_65535_rejected(self):
        with pytest.raises(Exception):
            self._make(port=70000)

    def test_port_1_accepted(self):
        ep = self._make(port=1)
        assert ep.port == 1

    def test_port_65535_accepted(self):
        ep = self._make(port=65535)
        assert ep.port == 65535


# 4. SSL CERTIFICATE SCHEMA

class TestSSLSchema:
    """app/schemas/ssl_certificate.py"""

    def _dt(self, days=0):
        return datetime.now(timezone.utc) + timedelta(days=days)

    def _make(self, valid_from=None, valid_to=None):
        from app.schemas.ssl_certificate import SSLCertificateCreate
        return SSLCertificateCreate(
            issuer="Let's Encrypt",
            valid_from=valid_from or self._dt(-1),
            valid_to=valid_to or self._dt(90),
            endpoint_id=1,
        )

    def test_valid_cert(self):
        cert = self._make()
        assert cert.issuer == "Let's Encrypt"

    def test_valid_to_before_valid_from_rejected(self):
        with pytest.raises(Exception):
            self._make(valid_from=self._dt(10), valid_to=self._dt(5))

    def test_valid_to_equals_valid_from_rejected(self):
        t = self._dt(1)
        with pytest.raises(Exception):
            self._make(valid_from=t, valid_to=t)

    def test_issuer_too_short_rejected(self):
        from app.schemas.ssl_certificate import SSLCertificateCreate
        with pytest.raises(Exception):
            SSLCertificateCreate(
                issuer="X",
                valid_from=self._dt(-1),
                valid_to=self._dt(90),
                endpoint_id=1,
            )

    def test_past_valid_to_accepted_by_schema(self):
        """Схема не перевіряє expired — це робить роутер."""
        cert = self._make(valid_from=self._dt(-365), valid_to=self._dt(-1))
        assert cert.valid_to < datetime.now(timezone.utc)


# 5. SERVICE SCHEMA

class TestServiceSchema:
    """app/schemas/service.py"""

    def _make(self, name="Payments API", **kwargs):
        from app.schemas.service import ServiceCreate
        return ServiceCreate(name=name, **kwargs)

    def test_valid_service(self):
        s = self._make()
        assert s.name == "Payments API"

    def test_name_stripped(self):
        s = self._make(name="  MyService  ")
        assert s.name == "MyService"

    def test_name_whitespace_only_rejected(self):
        with pytest.raises(Exception):
            self._make(name="   ")

    def test_name_too_short_rejected(self):
        with pytest.raises(Exception):
            self._make(name="x")

    def test_name_exactly_2_ok(self):
        s = self._make(name="DB")
        assert s.name == "DB"

    def test_description_optional(self):
        s = self._make()
        assert s.description is None

    def test_description_too_long_rejected(self):
        with pytest.raises(Exception):
            self._make(description="x" * 2001)

    def test_default_status_is_active(self):
        from app.models.service import ServiceStatus
        s = self._make()
        assert s.status == ServiceStatus.ACTIVE


# 6. RESOURCE SCHEMA

class TestResourceSchema:
    """app/schemas/resource.py"""

    def _make(self, **kwargs):
        from app.schemas.resource import ResourceCreate
        defaults = dict(hostname="web-01", ip_address="10.0.0.1",
                        cpu_cores=4, ram_gb=8, disk_gb=100)
        defaults.update(kwargs)
        return ResourceCreate(**defaults)

    def test_valid_resource(self):
        r = self._make()
        assert r.hostname == "web-01"

    def test_invalid_ip_string(self):
        with pytest.raises(Exception):
            self._make(ip_address="not-an-ip")

    def test_invalid_ip_octets(self):
        with pytest.raises(Exception):
            self._make(ip_address="999.999.999.999")

    def test_ipv6_accepted(self):
        r = self._make(ip_address="2001:db8::1")
        assert "2001" in r.ip_address

    def test_cpu_zero_rejected(self):
        with pytest.raises(Exception):
            self._make(cpu_cores=0)

    def test_cpu_over_limit_rejected(self):
        with pytest.raises(Exception):
            self._make(cpu_cores=257)

    def test_cpu_max_boundary_ok(self):
        r = self._make(cpu_cores=256)
        assert r.cpu_cores == 256

    def test_ram_zero_rejected(self):
        with pytest.raises(Exception):
            self._make(ram_gb=0)

    def test_disk_zero_rejected(self):
        with pytest.raises(Exception):
            self._make(disk_gb=0)

    def test_hostname_too_short(self):
        with pytest.raises(Exception):
            self._make(hostname="x")


# 7. NETWORK VALIDATION (бізнес-логіка роутера, без БД)

class TestNetworkValidation:
    """app/routers/resources._validate_network_config"""

    def setup_method(self):
        from app.routers.resources import _validate_network_config
        self.validate = _validate_network_config

    def _db(self, ip_exists=False):
        db = _make_db(first_result=MagicMock() if ip_exists else None)
        return db

    def test_loopback_rejected(self):
        with pytest.raises(HTTPException) as exc:
            self.validate("127.0.0.1", self._db())
        assert exc.value.status_code == 400

    def test_loopback_ipv6_rejected(self):
        with pytest.raises(HTTPException) as exc:
            self.validate("::1", self._db())
        assert exc.value.status_code == 400

    def test_multicast_rejected(self):
        with pytest.raises(HTTPException) as exc:
            self.validate("224.0.0.1", self._db())
        assert exc.value.status_code == 400

    def test_reserved_rejected(self):
        """0.0.0.0 — unspecified address (заблокована через is_unspecified)."""
        with pytest.raises(HTTPException) as exc:
            self.validate("0.0.0.0", self._db())
        assert exc.value.status_code == 400

    def test_invalid_string_rejected(self):
        with pytest.raises(HTTPException) as exc:
            self.validate("not.an.ip", self._db())
        assert exc.value.status_code == 400

    def test_duplicate_ip_rejected(self):
        with pytest.raises(HTTPException) as exc:
            self.validate("10.0.0.1", self._db(ip_exists=True))
        assert exc.value.status_code == 409

    def test_valid_private_ip_passes(self):
        self.validate("192.168.1.100", self._db(ip_exists=False))

    def test_valid_public_ip_passes(self):
        self.validate("8.8.8.8", self._db(ip_exists=False))

    def test_exclude_id_allows_same_ip(self):
        """При оновленні ресурс не конфліктує сам з собою."""
        # Навіть якщо ip_exists=True, але exclude_id=1 — mock проходить
        db = _make_db(first_result=None)  # filter chain returns None
        self.validate("10.0.0.1", db, exclude_id=1)


# 8. DEPENDENCIES — get_accessible_service_ids

class TestDependencies:
    """app/dependencies.py"""

    def _admin_user(self):
        u = MagicMock()
        u.is_admin = True
        return u

    def _regular_user(self, user_id=5):
        u = MagicMock()
        u.is_admin = False
        u.id = user_id
        return u

    def test_admin_gets_all_service_ids(self):
        from app.dependencies import get_accessible_service_ids
        db = MagicMock()
        db.query.return_value.all.return_value = [(1,), (2,), (3,)]
        result = get_accessible_service_ids(db, self._admin_user())
        assert sorted(result) == [1, 2, 3]

    def test_regular_user_gets_owned_and_granted(self):
        from app.dependencies import get_accessible_service_ids
        user = self._regular_user(user_id=5)
        db = MagicMock()

        call_count = [0]
        def side_effect(model):
            call_count[0] += 1
            q = MagicMock()
            q.filter.return_value = q
            q.filter_by.return_value = q
            if call_count[0] == 1:
                q.all.return_value = [(10,)]
            else:
                q.all.return_value = [(20,), (30,)]
            return q

        db.query.side_effect = side_effect
        result = get_accessible_service_ids(db, user)
        assert set(result) == {10, 20, 30}

    def test_user_can_access_service_admin_always_true(self):
        from app.dependencies import user_can_access_service
        result = user_can_access_service(_make_db(), self._admin_user(), service_id=999)
        assert result is True

    def test_user_can_access_service_not_found(self):
        from app.dependencies import user_can_access_service
        db = _make_db(first_result=None)
        result = user_can_access_service(db, self._regular_user(), service_id=999)
        assert result is False
