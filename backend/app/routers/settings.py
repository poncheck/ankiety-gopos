from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db import AppSettings

router = APIRouter()

STATIC_BASE = "/static/uploads"


def _row_to_public(row: AppSettings | None) -> dict:
    if row is None:
        return {"logo_url": None, "receipt_image_url": None, "receipt_instructions": None}
    return {
        "logo_url": f"{STATIC_BASE}/{row.logo_filename}" if row.logo_filename else None,
        "receipt_image_url": f"{STATIC_BASE}/{row.receipt_image_filename}" if row.receipt_image_filename else None,
        "receipt_instructions": row.receipt_instructions,
    }


@router.get("")
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    """Publiczny endpoint — zwraca ustawienia wyglądu dla strony ankiety (bez auth)."""
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    row = result.scalar_one_or_none()
    return _row_to_public(row)
