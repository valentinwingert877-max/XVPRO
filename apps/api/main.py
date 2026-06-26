"""
XVPRO — Backend API FastAPI
Point d'entrée principal
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import engine, Base
from routers import auth, matches, upload, teams, reports
import models  # noqa: F401 — importe les modèles pour créer les tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Création des tables au démarrage (utiliser Alembic en prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="XVPRO API",
    description="SaaS IA d'analyse de matchs de rugby",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://app.xvpro.fr"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router,    prefix="/auth",    tags=["Auth"])
app.include_router(matches.router, prefix="/matches", tags=["Matchs"])
app.include_router(upload.router,  prefix="/upload",  tags=["Upload"])
app.include_router(teams.router,   prefix="/teams",   tags=["Équipes"])
app.include_router(reports.router, prefix="/reports", tags=["Rapports"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "xvpro-api"}
