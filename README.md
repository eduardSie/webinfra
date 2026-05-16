# Internal Service Catalog Platform

FastAPI-based platform for managing internal services, resource allocation, endpoints, SSL certificates, and access control.

## What this project does

- Authenticates users with JWT (`/users/login`)
- Separates permissions into User Zone and Admin Zone
- Manages services and service-level user access grants
- Tracks infrastructure resources (servers) and allocation state
- Configures endpoints and enforces HTTPS-friendly constraints
- Tracks SSL certificates and certificate expiry windows
- Provides a global infrastructure summary report for admins
- Includes a static frontend (`frontend/`) and API backend (`app/`)

## Tech stack

- Python 3.12
- FastAPI + Uvicorn
- SQLAlchemy 2.x
- Alembic migrations
- PostgreSQL (default)
- JWT (`python-jose`) + password hashing (`passlib` + `bcrypt`)
- Vanilla JS frontend
- Docker multi-stage image

## Repository layout

```text
app/
  main.py                # FastAPI app and router registration
  config.py              # Environment-based settings
  database.py            # SQLAlchemy engine/session
  dependencies.py        # Auth and permission dependencies
  security.py            # Password hashing + JWT
  bootstrap.py           # Admin bootstrap script
  models/                # SQLAlchemy models
  routers/               # API routes
  schemas/               # Pydantic schemas

alembic/                 # DB migrations
frontend/                # Static SPA-style frontend
tests/                   # Unit tests
Dockerfile               # API image
start_instance.py        # Optional AWS EC2 helper
stop_instance.py         # Optional AWS EC2 helper
```

## Architecture and access model

### Authentication

- Login endpoint: `POST /users/login`
- Request type: `application/x-www-form-urlencoded`
- Response: access token (Bearer)
- Protected endpoints expect `Authorization: Bearer <token>`

### Authorization rules

- `admin` users can access all services/resources/endpoints and admin routes
- non-admin users can access:
  - services they own
  - services explicitly granted through `service_access`

### Business rules (high level)

- Self-registration is disabled. Only admins can create users.
- Admin users must use a corporate email domain (`@company.com` or `@corp.local`).
- Last active admin cannot be deactivated.
- Service names must be unique.
- Deprecated service cannot be revived.
- Service deletion requires:
  - no attached resources
  - non-active status
- Resource IPs are validated and must be unique.
- Endpoint domain must be unique.
- Port 80 is blocked for endpoint creation.
- One SSL certificate per endpoint.
- Expired certificates are rejected at attach time.

## Quick start (local)

### 1) Prerequisites

- Python 3.12+
- PostgreSQL running locally

### 2) Create and activate virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3) Install dependencies

```bash
pip install -r requirements.txt
```

### 4) Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/service_catalog
SECRET_KEY=CHANGE_ME_SUPER_SECRET
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

### 5) Run migrations

```bash
alembic upgrade head
```

### 6) Bootstrap first admin

```bash
python -m app.bootstrap
```

Default bootstrap credentials:

- username: `admin`
- password: `Admin12345`

Change credentials immediately in real deployments.

### 7) Run API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Frontend run

The frontend is static and calls API paths from the same origin (no hardcoded host).

Run a static server from `frontend/` on port `5500` (allowed by CORS):

```bash
cd frontend
python3 -m http.server 5500
```

Open:

- `http://localhost:5500`

## Docker

Build image:

```bash
docker build -t service-catalog-api .
```

Run container (example):

```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/service_catalog" \
  -e SECRET_KEY="CHANGE_ME_SUPER_SECRET" \
  service-catalog-api
```

Notes:

- Container exposes port `8000`.
- Default image command runs Uvicorn with 2 workers.
- Ensure your PostgreSQL host is reachable from the container.

## API endpoint map

### Users

- `POST /users/login` - public login
- `GET /users/me` - current user profile
- `GET /users/` - list users (admin)
- `POST /users/` - create user (admin)
- `PATCH /users/{user_id}/deactivate` - deactivate user (admin)
- `PATCH /users/{user_id}/activate` - reactivate user (admin)

### Services

- `GET /services/my` - list accessible services
- `GET /services/{service_id}` - service details (access-controlled)
- `POST /services/` - create service (admin)
- `PATCH /services/{service_id}` - update service (admin)
- `DELETE /services/{service_id}` - delete service (admin)
- `GET /services/{service_id}/access` - list service access entries (admin)
- `POST /services/{service_id}/access` - grant access (admin)
- `DELETE /services/{service_id}/access/{user_id}` - revoke access (admin)

### Resources

- `GET /resources/status` - list resources (filtered by access)
- `POST /resources/` - create resource (admin)
- `POST /resources/{resource_id}/allocate` - attach resource to service (admin)
- `POST /resources/{resource_id}/detach` - detach resource (admin)
- `DELETE /resources/{resource_id}` - delete resource (admin)

### Endpoints

- `GET /endpoints/` - list endpoints (filtered by access)
- `POST /endpoints/` - create endpoint (admin)
- `DELETE /endpoints/{endpoint_id}` - delete endpoint (admin)

### SSL

- `POST /ssl/` - attach certificate to endpoint (admin)
- `DELETE /ssl/{cert_id}` - revoke certificate (admin)
- `GET /ssl/expiry-check?days=30` - list certificates expiring within N days

### Reports

- `GET /reports/global` - global infrastructure report (admin)

## Example login request

```bash
curl -X POST "http://localhost:8000/users/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=Admin12345"
```

Use the returned token:

```bash
curl -X GET "http://localhost:8000/users/me" \
  -H "Authorization: Bearer <access_token>"
```

## Testing

Run unit tests:

```bash
pytest tests/test_unit.py -v
```

## Optional AWS EC2 helper scripts

- `start_instance.py` starts a preconfigured EC2 instance.
- `stop_instance.py` stops the same instance.

Before use, verify region/instance ID and AWS credentials in your environment.

## Production notes

- Replace default `SECRET_KEY`.
- Disable bootstrap default credentials in production workflows.
- Put API and frontend behind a reverse proxy/TLS terminator.
- Restrict CORS origins to known frontend domains.
- Use managed secrets and environment-specific configs.
