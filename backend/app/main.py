

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.storage import get_storage
from core.security import DomainVerificationMiddleware, require_api_key
from routers import (
    geo,
    speeches,
	parliamentMember,
	ideology,
	donors,
	electionHistory,
    payment,
)



settings = get_settings()

app = FastAPI(title="Kokkai Analysis API", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Extra verification beyond CORS:
# - Enforces Origin/Host allow-lists (where present)
# - Keeps /health public for ALB health checks
app.add_middleware(DomainVerificationMiddleware, settings=settings)

app.add_api_route("/health", 
					summary="Health check", 
					tags=["health"], 
					endpoint=lambda: {"status": "ok"},
					methods=["GET"])

# Protect API routes with API key auth (leave /health open).
app.include_router(speeches.router, dependencies=[Depends(require_api_key)])
app.include_router(geo.router, dependencies=[Depends(require_api_key)])
app.include_router(parliamentMember.router, dependencies=[Depends(require_api_key), Depends(get_storage)])
app.include_router(donors.router, dependencies=[Depends(require_api_key)])
app.include_router(ideology.router, dependencies=[Depends(require_api_key)])
app.include_router(electionHistory.router, dependencies=[Depends(require_api_key)])
app.include_router(payment.router, dependencies=[Depends(require_api_key)])