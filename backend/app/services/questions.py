from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import Category, ProductCache, Question


async def get_questions_for_product(
    gopos_product_id: int | None,
    db: AsyncSession,
) -> list[dict]:
    """Zwraca aktywne pytania dla kategorii produktu. Jeśli brak category — pusta lista."""
    if not gopos_product_id:
        return []

    result = await db.execute(
        select(ProductCache).where(ProductCache.gopos_product_id == gopos_product_id)
    )
    cache_entry = result.scalar_one_or_none()
    if not cache_entry or not cache_entry.category_id:
        return []

    result = await db.execute(
        select(Question)
        .where(Question.category_id == cache_entry.category_id, Question.active == True)  # noqa: E712
        .order_by(Question.position, Question.id)
    )
    questions = result.scalars().all()
    return [
        {
            "id": q.id,
            "text": q.text,
            "type": q.type,
            "options": q.options,
        }
        for q in questions
    ]
