import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from passlib.context import CryptContext
from sqlalchemy import select, text

from app.config import settings
from app.database import Base, AsyncSessionLocal, engine
from app.models.db import AdminUser
from app.routers import admin, survey
from app.routers import settings as settings_router

UPLOAD_DIR = "/app/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)  # musi być PRZED app.mount StaticFiles

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS email VARCHAR(255)")
        )
        await conn.execute(
            text("ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS code VARCHAR(20)")
        )
        await conn.execute(
            text("ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false")
        )
        # Unikalny paragon — jeden raz ankieta
        await conn.execute(
            text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'uq_survey_responses_fiscal_ref_id'
                    ) THEN
                        ALTER TABLE survey_responses
                            ADD CONSTRAINT uq_survey_responses_fiscal_ref_id
                            UNIQUE (fiscal_ref_id);
                    END IF;
                END $$;
            """)
        )

    # Seed pierwszego admina z .env jeśli tabela jest pusta
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AdminUser).limit(1))
        if result.scalar_one_or_none() is None:
            db.add(AdminUser(
                username=settings.admin_username,
                password_hash=_pwd_context.hash(settings.admin_password),
                is_active=True,
            ))
            await db.commit()

    yield


app = FastAPI(title="Ankiety GoPOS", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="/app/static"), name="static")

app.include_router(survey.router, prefix="/api/survey", tags=["survey"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"])


@app.get("/health")
async def health():
    return {"status": "ok"}
