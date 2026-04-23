from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.database import engine, Base
from app.models import *  # registers all models with Base

# Import all routers
from app.routes.auth_routes     import router as auth_router
from app.routes.document_routes import router as document_router
from app.routes.scrutiny_routes import router as scrutiny_router
from app.routes.medical_routes  import router as medical_router
from app.routes.finance_routes  import router as finance_router
from app.routes.ddo_routes      import router as ddo_router
from app.routes.query_routes    import router as query_router
from app.models import *
from app.routes import auth_routes
from app.routes import employee_routes
# Create all tables (safe — skips existing tables)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title       = "MedReimburse API",
    description = "Government Medical Reimbursement System — Maharashtra",
    version     = "1.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# Register all routers
app.include_router(auth_routes.router)
app.include_router(employee_routes.router)
app.include_router(document_router, prefix="/documents")
app.include_router(scrutiny_router)
app.include_router(medical_router)
app.include_router(finance_router)
app.include_router(ddo_router)
app.include_router(query_router, prefix="/queries")


@app.get("/", tags=["Health"])
def root():
    return {
        "status":  "running",
        "project": "MedReimburse",
        "docs":    "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
