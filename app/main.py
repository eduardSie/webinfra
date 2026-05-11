from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import users, services, resources, endpoints, ssl, reports

app = FastAPI(
    title="Internal Service Catalog Platform",
    description="Internal Service Catalog Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(services.router)
app.include_router(resources.router)
app.include_router(endpoints.router)
app.include_router(ssl.router)
app.include_router(reports.router)

@app.get("/")
def root():
    return {"message": "Internal Service Catalog API", "status": "running"}