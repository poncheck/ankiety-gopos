import logging
import time

import httpx
from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)

_token_cache: dict = {"access_token": None, "expires_at": 0}


def _is_configured() -> bool:
    return bool(settings.crm_client_id and settings.crm_client_secret and settings.crm_organization_id)


async def _get_access_token(client: httpx.AsyncClient) -> str:
    now = time.time()
    if _token_cache["access_token"] and now < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    response = await client.post(
        f"{settings.crm_base_url}/oauth/token",
        data={
            "grant_type": "organization",
            "client_id": settings.crm_client_id,
            "client_secret": settings.crm_client_secret,
            "organization_id": settings.crm_organization_id,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Błąd autoryzacji GoCRM: {response.status_code} {response.text[:200]}",
        )

    data = response.json()
    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + int(data.get("expires_in", 900))
    return _token_cache["access_token"]


async def create_voucher(
    source_reference_id: str,
    contact_id: int | None = None,
) -> str | None:
    """
    Tworzy voucher w GoCRM i zwraca jego kod.
    Jeśli CRM nie jest skonfigurowany, zwraca None (fallback do losowego kodu).

    source_reference_id — unikalny identyfikator źródła (np. numer paragonu)
    contact_id          — opcjonalne ID kontaktu w GoCRM
    """
    if not _is_configured():
        return None

    payload: dict = {
        "product_id": settings.crm_voucher_product_id,
        "name": "Voucher Ankieta",
        "status": "ACTIVE",
        "source": {
            "id": source_reference_id,
            "name": "System Ankiet",
        },
    }
    if contact_id:
        payload["contact_id"] = contact_id

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token = await _get_access_token(client)
            response = await client.post(
                f"{settings.crm_base_url}/api/organizations/{settings.crm_organization_id}/vouchers",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if response.status_code == 200:
            data = response.json()
            code = data.get("data", {}).get("code")
            if code:
                logger.info("GoCRM voucher utworzony: %s (paragon: %s)", code, source_reference_id)
                return str(code)

        logger.warning("GoCRM: nieoczekiwana odpowiedź %s: %s", response.status_code, response.text[:200])
        return None

    except Exception as exc:
        logger.warning("GoCRM: błąd tworzenia vouchera (%s), używam fallback", exc)
        return None
