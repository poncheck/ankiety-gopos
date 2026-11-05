import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import AppSettings, Category, ProductCache, Question

MAX_QUESTIONS_PER_RECEIPT = 20


async def get_excluded_product_ids(db: AsyncSession) -> set[int]:
    """Zwraca gopos_product_id wszystkich produktów, których kategoria jest
    oznaczona jako wykluczona z ankiety (np. opakowania na wynos)."""
    result = await db.execute(
        select(ProductCache.gopos_product_id)
        .join(Category, Category.id == ProductCache.category_id)
        .where(Category.excluded_from_survey == True)  # noqa: E712
    )
    return {row[0] for row in result.all()}


async def filter_excluded_products(products, db: AsyncSession):
    """Usuwa z listy produkty należące do wykluczonej kategorii — nie będą
    w ogóle widoczne w ankiecie klienta (nie tylko bez pytań)."""
    excluded_ids = await get_excluded_product_ids(db)
    if not excluded_ids:
        return products
    return [p for p in products if p.gopos_product_id not in excluded_ids]


async def get_questions_for_category(category_id: int | None, db: AsyncSession) -> list[dict]:
    """Zwraca wszystkie aktywne pytania danej kategorii (pozycja, id)."""
    if not category_id:
        return []
    result = await db.execute(
        select(Question)
        .where(Question.category_id == category_id, Question.active == True)  # noqa: E712
        .order_by(Question.position, Question.id)
    )
    questions = result.scalars().all()
    return [
        {"id": q.id, "text": q.text, "type": q.type, "options": q.options}
        for q in questions
    ]


async def _get_product_category_id(gopos_product_id: int | None, db: AsyncSession) -> int | None:
    if not gopos_product_id:
        return None
    result = await db.execute(
        select(ProductCache.category_id).where(ProductCache.gopos_product_id == gopos_product_id)
    )
    row = result.first()
    return row[0] if row else None


async def get_questions_for_product(gopos_product_id: int | None, db: AsyncSession) -> list[dict]:
    """Zwraca wszystkie aktywne pytania dla kategorii produktu. Jeśli brak category — pusta lista."""
    category_id = await _get_product_category_id(gopos_product_id, db)
    return await get_questions_for_category(category_id, db)


async def get_global_category_settings(db: AsyncSession):
    """Zwraca (category, questions) dla kategorii zbiorczej skonfigurowanej w ustawieniach,
    albo (None, []) jeśli nie ustawiono żadnej lub nie ma dla niej aktywnych pytań."""
    settings_result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    settings_row = settings_result.scalar_one_or_none()
    if not settings_row or not settings_row.global_category_id:
        return None, []

    category = await db.get(Category, settings_row.global_category_id)
    if not category:
        return None, []

    questions = await get_questions_for_category(category.id, db)
    return category, questions


async def select_questions_for_bill(
    products,
    db: AsyncSession,
    exclude_category_id: int | None = None,
) -> dict[str, list[dict]]:
    """
    Dystrybuuje pytania ankiety między produkty z paragonu.

    Zasady:
    - Łączna liczba pytań nie przekracza MAX_QUESTIONS_PER_RECEIPT (20).
    - Pytania są wybierane losowo z puli aktywnych pytań każdej kategorii.
    - Sloty są rozdzielane równomiernie między produkty mające przypisane pytania;
      nadmiarowe sloty (np. gdy produkt ma mniej pytań niż jego przydział)
      są redystrybuowane do pozostałych produktów.
    - exclude_category_id: kategoria zbiorcza (jeśli skonfigurowana) jest wyłączona
      z tej normalnej dystrybucji — jej pytania są dodawane osobno, na końcu ankiety.

    Zwraca słownik: product.id -> lista pytań (już wylosowanych).
    """
    # Pobierz pełną pulę pytań dla każdego produktu
    pools: dict[str, list[dict]] = {}
    for product in products:
        category_id = await _get_product_category_id(product.gopos_product_id, db)
        if exclude_category_id is not None and category_id == exclude_category_id:
            continue
        all_qs = await get_questions_for_category(category_id, db)
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
