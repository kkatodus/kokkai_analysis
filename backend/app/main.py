

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from routers import (
    donors,
    geo,
    manifesto,
    payment,
    policy,
    reprs,
    sangiin,
    speeches,
    stats,
    shugiin,
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

app.add_api_route("/health", summary="Health check", tags=["health"], endpoint=lambda: {"status": "ok"})
app.include_router(sangiin.router)
app.include_router(shugiin.router)
app.include_router(speeches.router)
app.include_router(stats.router)
app.include_router(geo.router)
app.include_router(reprs.router)
app.include_router(payment.router)
app.include_router(donors.router)
app.include_router(policy.router)
app.include_router(manifesto.router)
