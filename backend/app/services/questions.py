import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import ProductCache, Question

MAX_QUESTIONS_PER_RECEIPT = 20


async def get_questions_for_product(
    gopos_product_id: int | None,
    db: AsyncSession,
) -> list[dict]:
    """Zwraca wszystkie aktywne pytania dla kategorii produktu. Jeśli brak category — pusta lista."""
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


async def select_questions_for_bill(products, db: AsyncSession) -> dict[str, list[dict]]:
    """
    Dystrybuuje pytania ankiety między produkty z paragonu.

    Zasady:
    - Łączna liczba pytań nie przekracza MAX_QUESTIONS_PER_RECEIPT (20).
    - Pytania są wybierane losowo z puli aktywnych pytań każdej kategorii.
    - Sloty są rozdzielane równomiernie między produkty mające przypisane pytania;
      nadmiarowe sloty (np. gdy produkt ma mniej pytań niż jego przydział)
      są redystrybuowane do pozostałych produktów.

    Zwraca słownik: product.id -> lista pytań (już wylosowanych).
    """
    # Pobierz pełną pulę pytań dla każdego produktu
    pools: dict[str, list[dict]] = {}
    for product in products:
        all_qs = await get_questions_for_product(product.gopos_product_id, db)
        if all_qs:
            pools[product.id] = all_qs

    # Wynik domyślnie pusty dla każdego produktu
    result: dict[str, list[dict]] = {p.id: [] for p in products}

    if not pools:
        return result

    n = len(pools)
    base = MAX_QUESTIONS_PER_RECEIPT // n
    remainder = MAX_QUESTIONS_PER_RECEIPT % n

    # Pierwsza tura: równomierny przydział slotów
    product_ids = list(pools.keys())
    for i, pid in enumerate(product_ids):
        alloc = base + (1 if i < remainder else 0)
        pool = pools[pid]
        count = min(alloc, len(pool))
        result[pid] = random.sample(pool, count)

    # Druga tura: redystrybuuj niewykorzystane sloty
    used = sum(len(v) for v in result.values())
    remaining = MAX_QUESTIONS_PER_RECEIPT - used

    if remaining > 0:
        for pid in product_ids:
            if remaining <= 0:
                break
            already_ids = {q["id"] for q in result[pid]}
            extras = [q for q in pools[pid] if q["id"] not in already_ids]
            take = min(remaining, len(extras))
            if take > 0:
                result[pid].extend(random.sample(extras, take))
                remaining -= take

    return result
