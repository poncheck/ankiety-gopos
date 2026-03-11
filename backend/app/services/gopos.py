import logging
import time
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.db import Category, ProductCache
from app.models.survey import BillResponse, Product

logger = logging.getLogger(__name__)

SEARCH_DAYS = 7  # okno czasowe szukania paragonu

_token_cache: dict = {"access_token": None, "expires_at": 0}


async def _get_access_token(client: httpx.AsyncClient) -> str:
    now = time.time()
    if _token_cache["access_token"] and now < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    logger.info("Pobieranie tokena GoPOS (grant_type=organization)...")
    try:
        response = await client.post(
            f"{settings.gopos_base_url}/oauth/token",
            data={
                "grant_type": "organization",
                "client_id": settings.gopos_client_id,
                "client_secret": settings.gopos_client_secret,
                "organization_id": settings.gopos_organization_id,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"GoPOS API niedostępne: {exc}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Błąd autoryzacji GoPOS: {response.status_code} {response.text[:200]}",
        )

    data = response.json()
    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + int(data.get("expires_in", 3600))
    return _token_cache["access_token"]


async def sync_categories(db: AsyncSession) -> tuple[int, int]:
    """Pobiera kategorie z GoPOS i synchronizuje z lokalną bazą. Zwraca (added, updated)."""
    org = settings.gopos_organization_id
    url = f"{settings.gopos_base_url}/api/v3/{org}/categories"

    async with httpx.AsyncClient(timeout=15.0) as client:
        token = await _get_access_token(client)
        try:
            response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"GoPOS API niedostępne: {exc}")

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Błąd GoPOS API (kategorie): {response.status_code} {response.text[:200]}",
            )

        body = response.json()
        remote_cats = body if isinstance(body, list) else body.get("data", [])

    result = await db.execute(select(Category))
    existing = {c.gopos_id: c for c in result.scalars().all()}

    added = 0
    updated = 0
    for cat in remote_cats:
        gid = cat.get("id")
        name = cat.get("name") or cat.get("label") or str(gid)
        if gid is None:
            continue
        if gid in existing:
            if existing[gid].name != name:
                existing[gid].name = name
                updated += 1
        else:
            db.add(Category(gopos_id=gid, name=name))
            added += 1

    await db.commit()
    return added, updated


async def sync_items(db: AsyncSession) -> tuple[int, int]:
    """Pobiera produkty z GoPOS /items i uzupełnia product_cache z przypisaniami kategorii."""
    org = settings.gopos_organization_id
    url = f"{settings.gopos_base_url}/api/v3/{org}/items"

    all_items: list[dict] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await _get_access_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        page = 0
        while True:
            try:
                response = await client.get(
                    url,
                    params={"include": "category", "size": 100, "page": page},
                    headers=headers,
                )
            except httpx.RequestError as exc:
                raise HTTPException(status_code=503, detail=f"GoPOS API niedostępne: {exc}")

            if response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Błąd GoPOS API (items): {response.status_code} {response.text[:200]}",
                )

            body = response.json()
            items = body if isinstance(body, list) else body.get("data", [])
            all_items.extend(items)
            if len(items) < 100:
                break
            page += 1

    # Załaduj kategorie i cache do pamięci
    cat_result = await db.execute(select(Category))
    cats_by_gopos_id = {c.gopos_id: c for c in cat_result.scalars().all()}

    cache_result = await db.execute(select(ProductCache))
    cache_by_pid = {c.gopos_product_id: c for c in cache_result.scalars().all()}

    if all_items:
        sample = all_items[0]
        logger.info(
            "sync_items — przykładowy item z GoPOS /items: klucze=%s, id=%s, category_id=%s, category=%s",
            list(sample.keys()), sample.get("id"), sample.get("category_id"), sample.get("category"),
        )

    added = 0
    updated = 0
    for item in all_items:
        pid = item.get("id")
        name = item.get("name") or str(pid)
        if not pid:
            continue

        category_obj = item.get("category") or {}
        gopos_cat_id = item.get("category_id") or category_obj.get("id")
        cat = cats_by_gopos_id.get(gopos_cat_id) if gopos_cat_id else None
        logger.info("Item %s (%s): category_id=%s → cat=%s", name, pid, gopos_cat_id, cat.name if cat else None)

        if pid in cache_by_pid:
            entry = cache_by_pid[pid]
            changed = False
            if entry.name != name:
                entry.name = name
                changed = True
            if cat and entry.category_id != cat.id:
                entry.category_id = cat.id
                changed = True
            if changed:
                updated += 1
        else:
            db.add(ProductCache(
                gopos_product_id=pid,
                category_id=cat.id if cat else None,
                name=name,
            ))
            added += 1

    await db.commit()
    return added, updated


async def _fetch_order_raw(fiscal_ref_id: str, include: str) -> dict:
    """Wyszukuje zamówienie po fiscal_ref_id i zwraca surowy dict."""
    org = settings.gopos_organization_id
    url = f"{settings.gopos_base_url}/api/v3/{org}/orders"
    date_from = (datetime.now(timezone.utc) - timedelta(days=SEARCH_DAYS)).strftime(
        "%Y-%m-%dT%H:%M:%S"
    )

    async with httpx.AsyncClient(timeout=15.0) as client:
        token = await _get_access_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        page = 0
        while True:
            try:
                response = await client.get(
                    url,
                    params={
                        "status": "CLOSED",
                        "include": include,
                        "closed_at_from": date_from,
                        "size": 100,
                        "page": page,
                        "sort": "id,desc",
                    },
                    headers=headers,
                )
            except httpx.RequestError as exc:
                raise HTTPException(status_code=503, detail=f"GoPOS API niedostępne: {exc}")

            if response.status_code == 401:
                _token_cache["access_token"] = None
                raise HTTPException(status_code=502, detail="Błąd autoryzacji GoPOS API")
            if response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Błąd GoPOS API: {response.status_code} {response.text[:200]}",
                )

            body = response.json()
            orders = body if isinstance(body, list) else body.get("data", [])

            for order in orders:
                fisk = order.get("fiscalization") or {}
                if str(fisk.get("reference_id", "")) == str(fiscal_ref_id):
                    return order

            if len(orders) < 100:
                break
            page += 1

    raise HTTPException(
        status_code=404,
        detail=f"Nie znaleziono paragonu o numerze {fiscal_ref_id} (ostatnie {SEARCH_DAYS} dni)",
    )


async def get_bill(fiscal_ref_id: str) -> BillResponse:
    """Szuka zamówienia po numerze paragonu fiskalnego (fiscalization.reference_id)."""
    order = await _fetch_order_raw(
        fiscal_ref_id,
        include="fiscalization,items,items.product",
    )
    return _parse_order(fiscal_ref_id, order)


async def debug_bill(fiscal_ref_id: str) -> list[dict]:
    """Zwraca surowe dane itemów z GoPOS — pokazuje wszystkie klucze dla diagnostyki."""
    order = await _fetch_order_raw(
        fiscal_ref_id,
        include="fiscalization,items,items.product",
    )
    raw_items = order.get("items") or []
    result = []
    for item in raw_items:
        product_obj = item.get("product") or {}
        # Zwróć też surowy item żeby zobaczyć wszystkie pola
        safe_item = {k: v for k, v in item.items() if k != "product"}
        result.append({
            "item_keys": list(item.keys()),
            "item_uid": item.get("uid"),
            "item_status": item.get("status"),
            "item_name": item.get("name"),
            "item_product_id": item.get("product_id"),
            "item_category_id": item.get("category_id"),
            "item_category": item.get("category"),
            "item_other_fields": safe_item,
            "product_keys": list(product_obj.keys()),
            "product_id": product_obj.get("id"),
            "product_name": product_obj.get("name"),
            "product_category_id": product_obj.get("category_id"),
            "product_category": product_obj.get("category"),
        })
    return result


def _parse_order(fiscal_ref_id: str, order: dict) -> BillResponse:
    """Mapuje zamówienie GoPOS na nasz model — sprawdza zarówno item jak i product."""
    raw_items = order.get("items") or []

    products = []
    for idx, item in enumerate(raw_items):
        if item.get("status") != "ACTIVE":
            continue

        # GoPOS: item.id = UUID linii zamówienia, item.item_id = ID produktu w katalogu
        item_line_id = item.get("id")       # UUID np. "677c8fae-..."
        gopos_product_id = item.get("item_id")  # int, np. 504

        name = item.get("name") or f"Produkt {idx + 1}"

        unit_price = item.get("unit_price") or {}
        price = float(unit_price.get("amount") or 0)

        logger.info(
            "Item: %s | item_id=%s | line_uuid=%s",
            name, gopos_product_id, item_line_id,
        )

        products.append(Product(
            id=str(item_line_id or gopos_product_id or idx),
            gopos_product_id=gopos_product_id,
            gopos_category_id=None,  # kategoria pochodzi z product_cache (sync_items)
            name=name,
            quantity=float(item.get("quantity") or 1),
            price=price,
        ))

    return BillResponse(bill_number=fiscal_ref_id, products=products)
