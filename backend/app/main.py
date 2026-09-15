import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import distinct, select, update

from app.api import biomarkers_router, labs_router
from app.core.config import settings
from app.core.database import async_session_maker, init_db
from app.models.lab import BiomarkerRecord
from app.services.unit_converter import unit_converter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("labtrack")


async def reconcile_biomarker_canonical_names() -> None:
    """Migrate and reconcile non-canonical biomarker names in database."""
    try:
        async with async_session_maker() as session:
            stmt = select(distinct(BiomarkerRecord.name))
            result = await session.execute(stmt)
            names = result.scalars().all()
            updated_count = 0
            for old_name in names:
                if not old_name:
                    continue
                canonical = unit_converter.canonical_biomarker_name(old_name)
                if canonical and canonical != old_name:
                    update_stmt = (
                        update(BiomarkerRecord)
                        .where(BiomarkerRecord.name == old_name)
                        .values(name=canonical)
                    )
                    await session.execute(update_stmt)
                    updated_count += 1
            if updated_count > 0:
                await session.commit()
                logger.info(
                    "Reconciled %d biomarker aliases to English standards",
                    updated_count,
                )
    except (OSError, RuntimeError) as e:
        logger.warning("Biomarker reconciliation deferred: %s", e)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Initializing LabTrack services...")
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    try:
        await init_db()
        await reconcile_biomarker_canonical_names()
    except (OSError, RuntimeError) as e:
        logger.warning("Database initialization deferred or failed: %s", e)
    yield
    logger.info("Shutting down LabTrack services...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="LabTrack: Automated biomarker extraction and analytics.",
    lifespan=lifespan,
)

# CORS setup
origins = (
    settings.CORS_ORIGINS
    if isinstance(settings.CORS_ORIGINS, list)
    else [settings.CORS_ORIGINS]
)
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
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    return {
        "name": settings.PROJECT_NAME,
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }
