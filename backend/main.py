from __future__ import annotations

import logging
from typing import Any, Dict
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.actions import router as actions_router
from backend.api.scenarios import router as scenarios_router
from backend.api.services import router as services_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cloud-optimizer-backend")

app = FastAPI(
    title="Cloud Cost Optimization Agent - Backend & Cloud Simulator",
    description=(
        "Simulated cloud environment with deterministic safety validation and verification endpoints "
        "for the Cloud Cost Optimization Agent hackathon project."
    ),
    version="1.0.0",
)

# CORS Configuration for local frontend development (e.g. Vite React frontend)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled error during request {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred in the cloud simulator backend."},
    )


# Register Routers
app.include_router(services_router)
app.include_router(actions_router)
app.include_router(scenarios_router)


@app.get("/api/health", tags=["System"])
def health_check() -> Dict[str, Any]:
    """
    Backend liveness check.
    """
    return {
        "status": "healthy",
        "service": "cloud-cost-optimization-agent-backend",
        "author": "Laksh (Backend + Simulator + Safety)",
        "version": "1.0.0",
    }


@app.get("/", tags=["System"])
def root_info() -> Dict[str, Any]:
    """
    Root API entrypoint and documentation summary.
    """
    return {
        "message": "Cloud Cost Optimization Agent Backend & Cloud Simulator",
        "docs_url": "/docs",
        "api_endpoints": {
            "services": "/api/services",
            "actions": "/api/actions",
            "verify": "/api/actions/{action_id}/verify",
            "scenarios": "/api/scenarios",
            "reset": "/api/reset",
            "health": "/api/health",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
