import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import biomarkers_router, labs_router
from app.core.config import settings
from app.core.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("labtrack")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing LabTrack services...")
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    try:
        await init_db()
    except Exception as e:
        logger.warning(f"Database initialization deferred or failed: {e}")
    yield
    logger.info("Shutting down LabTrack services...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="LabTrack: Automated blood biomarker extraction, standardization, and trend analytics.",
    lifespan=lifespan,
)

# CORS setup
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(labs_router, prefix=settings.API_V1_STR)
app.include_router(biomarkers_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }

