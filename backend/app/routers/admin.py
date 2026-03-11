import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.db import Answer, AppSettings, Category, ProductCache, Question, SurveyResponse
from app.services.gopos import debug_bill, sync_categories, sync_items

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8
UPLOAD_DIR = "/app/static/uploads"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


class InstructionsUpdate(BaseModel):
    text: str | None = None

router = APIRouter()


# ---------- Auth ----------

class LoginRequest(BaseModel):
    username: str
    password: str


def _create_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, settings.secret_key, algorithm=ALGORITHM)


async def _get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("sub") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Nieautoryzowany")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Nieważny token")


@router.post("/login")
async def login(body: LoginRequest):
    if body.username != settings.admin_username or body.password != settings.admin_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Błędne dane logowania")
    token = _create_token({"sub": "admin"})
    return {"access_token": token, "token_type": "bearer"}


# ---------- Categories ----------

@router.get("/categories", dependencies=[Depends(_get_current_admin)])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            Category.id,
            Category.gopos_id,
            Category.name,
            Category.created_at,
            func.count(Question.id).label("question_count"),
        )
        .outerjoin(Question, Question.category_id == Category.id)
        .group_by(Category.id)
        .order_by(Category.name)
    )
    rows = result.all()
    return [
        {
            "id": r.id,
            "gopos_id": r.gopos_id,
            "name": r.name,
            "created_at": r.created_at,
            "question_count": r.question_count,
        }
        for r in rows
    ]


@router.post("/categories/sync", dependencies=[Depends(_get_current_admin)])
async def sync_categories_endpoint(db: AsyncSession = Depends(get_db)):
    added, updated = await sync_categories(db)
    return {"added": added, "updated": updated}


# ---------- Questions ----------

@router.get("/categories/{category_id}/questions", dependencies=[Depends(_get_current_admin)])
async def list_questions(category_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Question)
        .where(Question.category_id == category_id)
        .order_by(Question.position, Question.id)
    )
    questions = result.scalars().all()
    return [
        {
            "id": q.id,
            "category_id": q.category_id,
            "text": q.text,
            "type": q.type,
            "options": q.options,
            "position": q.position,
            "active": q.active,
            "created_at": q.created_at,
        }
        for q in questions
    ]


class QuestionCreate(BaseModel):
    text: str
    type: str
    options: list[str] | None = None
    position: int = 0
    active: bool = True


@router.post("/categories/{category_id}/questions", dependencies=[Depends(_get_current_admin)])
async def create_question(category_id: int, body: QuestionCreate, db: AsyncSession = Depends(get_db)):
    cat = await db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Kategoria nie istnieje")
    if body.type not in ("rating", "yesno", "text", "choice"):
        raise HTTPException(status_code=422, detail="Nieprawidłowy typ pytania")
    q = Question(
        category_id=category_id,
        text=body.text,
        type=body.type,
        options=body.options,
        position=body.position,
        active=body.active,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return {"id": q.id, "category_id": q.category_id, "text": q.text, "type": q.type,
            "options": q.options, "position": q.position, "active": q.active}


class QuestionUpdate(BaseModel):
    text: str | None = None
    type: str | None = None
    options: list[str] | None = None
    position: int | None = None
    active: bool | None = None


@router.put("/questions/{question_id}", dependencies=[Depends(_get_current_admin)])
async def update_question(question_id: int, body: QuestionUpdate, db: AsyncSession = Depends(get_db)):
    q = await db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Pytanie nie istnieje")
    if body.text is not None:
        q.text = body.text
    if body.type is not None:
        if body.type not in ("rating", "yesno", "text", "choice"):
            raise HTTPException(status_code=422, detail="Nieprawidłowy typ pytania")
        q.type = body.type
    if body.options is not None:
        q.options = body.options
    if body.position is not None:
        q.position = body.position
    if body.active is not None:
        q.active = body.active
    await db.commit()
    await db.refresh(q)
    return {"id": q.id, "text": q.text, "type": q.type, "options": q.options,
            "position": q.position, "active": q.active}


@router.delete("/questions/{question_id}", dependencies=[Depends(_get_current_admin)])
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db)):
    q = await db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Pytanie nie istnieje")
    await db.delete(q)
    await db.commit()
    return {"deleted": question_id}


# ---------- Responses ----------

@router.get("/responses", dependencies=[Depends(_get_current_admin)])
async def list_responses(
    page: int = 0,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    total_result = await db.execute(select(func.count(SurveyResponse.id)))
    total = total_result.scalar()

    result = await db.execute(
        select(SurveyResponse)
        .order_by(SurveyResponse.created_at.desc())
        .offset(page * size)
        .limit(size)
    )
    responses = result.scalars().all()

    items = []
    for r in responses:
        answers_result = await db.execute(
            select(func.count(Answer.id)).where(Answer.response_id == r.id)
        )
        answer_count = answers_result.scalar()

        # Distinct produkty w tej odpowiedzi (zachowaj kolejność wg product_id)
        products_result = await db.execute(
            select(Answer.product_id, Answer.product_name)
            .where(Answer.response_id == r.id)
            .group_by(Answer.product_id, Answer.product_name)
        )
        products = [
            {"id": row.product_id, "name": row.product_name or row.product_id}
            for row in products_result.all()
        ]

        items.append({
            "id": r.id,
            "fiscal_ref_id": r.fiscal_ref_id,
            "gopos_order_number": r.gopos_order_number,
            "created_at": r.created_at,
            "answer_count": answer_count,
            "products": products,
        })

    return {"total": total, "page": page, "size": size, "items": items}


@router.get("/responses/{response_id}", dependencies=[Depends(_get_current_admin)])
async def get_response(response_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.get(SurveyResponse, response_id)
    if not r:
        raise HTTPException(status_code=404, detail="Odpowiedź nie istnieje")

    answers_result = await db.execute(
        select(Answer).where(Answer.response_id == response_id).order_by(Answer.product_name, Answer.id)
    )
    answers = answers_result.scalars().all()

    return {
        "id": r.id,
        "fiscal_ref_id": r.fiscal_ref_id,
        "gopos_order_number": r.gopos_order_number,
        "created_at": r.created_at,
        "answers": [
            {
                "id": a.id,
                "product_id": a.product_id,
                "product_name": a.product_name,
                "question_id": a.question_id,
                "question_text": a.question_text,
                "value": a.value,
            }
            for a in answers
        ],
    }


# ---------- Stats ----------

@router.get("/stats/products", dependencies=[Depends(_get_current_admin)])
async def product_stats(db: AsyncSession = Depends(get_db)):
    """Zagregowane statystyki odpowiedzi per produkt i pytanie (wszystkie ankiety)."""
    rows_result = await db.execute(
        select(Answer.product_name, Answer.question_text, Answer.value, func.count(Answer.id))
        .where(Answer.product_name != "")
        .group_by(Answer.product_name, Answer.question_text, Answer.value)
        .order_by(Answer.product_name, Answer.question_text, Answer.value)
    )
    rows = rows_result.all()

    # Buduj strukturę: {product_name: {question_text: {value: count}}}
    products: dict[str, dict[str, dict[str, int]]] = {}
    for product_name, question_text, value, count in rows:
        if product_name not in products:
            products[product_name] = {}
        if question_text not in products[product_name]:
            products[product_name][question_text] = {}
        products[product_name][question_text][value] = count

    result = []
    for product_name, questions in products.items():
        q_list = []
        product_total = 0
        for question_text, answers in questions.items():
            total = sum(answers.values())
            product_total += total

            # Sprawdź czy to pytanie ratingowe (klucze: "1"–"5")
            keys = set(answers.keys())
            numeric_keys = {str(i) for i in range(1, 6)}
            is_rating = keys.issubset(numeric_keys) and keys.issubset(numeric_keys)

            q_entry: dict = {
                "question_text": question_text,
                "answers": answers,
                "total": total,
            }
            if is_rating:
                weighted = sum(int(v) * c for v, c in answers.items())
                q_entry["avg"] = round(weighted / total, 2) if total else 0

            q_list.append(q_entry)

        result.append({
            "product_name": product_name,
            "total_answers": product_total,
            "questions": q_list,
        })

    # Sortuj malejąco po łącznej liczbie odpowiedzi
    result.sort(key=lambda x: x["total_answers"], reverse=True)
    return result


# ---------- Product cache ----------

@router.get("/products", dependencies=[Depends(_get_current_admin)])
async def list_products(db: AsyncSession = Depends(get_db)):
    """Lista wszystkich produktów w cache wraz z przypisanymi kategoriami."""
    result = await db.execute(
        select(
            ProductCache.id,
            ProductCache.gopos_product_id,
            ProductCache.name,
            ProductCache.category_id,
            Category.name.label("category_name"),
        )
        .outerjoin(Category, Category.id == ProductCache.category_id)
        .order_by(ProductCache.name)
    )
    rows = result.all()
    return [
        {
            "id": r.id,
            "gopos_product_id": r.gopos_product_id,
            "name": r.name,
            "category_id": r.category_id,
            "category_name": r.category_name,
        }
        for r in rows
    ]


class ProductCategoryAssign(BaseModel):
    category_id: int


@router.put("/products/{gopos_product_id}/category", dependencies=[Depends(_get_current_admin)])
async def assign_product_category(
    gopos_product_id: int,
    body: ProductCategoryAssign,
    db: AsyncSession = Depends(get_db),
):
    """Ręcznie przypisuje kategorię do produktu w cache."""
    cat = await db.get(Category, body.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Kategoria nie istnieje")

    result = await db.execute(
        select(ProductCache).where(ProductCache.gopos_product_id == gopos_product_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Produkt nie istnieje w cache")

    entry.category_id = body.category_id
    await db.commit()
    return {"gopos_product_id": gopos_product_id, "category_id": body.category_id, "category_name": cat.name}


# ---------- Debug ----------

@router.post("/products/sync", dependencies=[Depends(_get_current_admin)])
async def sync_items_endpoint(db: AsyncSession = Depends(get_db)):
    """Pobiera wszystkie produkty z GoPOS /items i uzupełnia product_cache."""
    added, updated = await sync_items(db)
    return {"added": added, "updated": updated}


# ---------- Debug ----------

@router.get("/debug/bill/{bill_number}", dependencies=[Depends(_get_current_admin)])
async def debug_bill_endpoint(bill_number: str):
    """Zwraca surowe dane produktów z GoPOS — pomocne przy diagnozowaniu kategorii."""
    return await debug_bill(bill_number)


# ---------- Settings ----------

def _save_uploaded_file(content: bytes, content_type: str, old_filename: str | None) -> str:
    """Zapisuje plik na dysk (UUID name), usuwa stary plik. Zwraca nową nazwę pliku."""
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    ext = ext_map.get(content_type, ".bin")
    filename = f"{uuid.uuid4().hex}{ext}"
    if old_filename:
        old_path = os.path.join(UPLOAD_DIR, old_filename)
        if os.path.exists(old_path):
            os.remove(old_path)
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(content)
    return filename


async def _get_or_create_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        row = AppSettings(id=1)
        db.add(row)
        await db.flush()
    return row


@router.get("/settings", dependencies=[Depends(_get_current_admin)])
async def get_admin_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        return {"logo_filename": None, "receipt_image_filename": None, "receipt_instructions": None}
    return {
        "logo_filename": row.logo_filename,
        "receipt_image_filename": row.receipt_image_filename,
        "receipt_instructions": row.receipt_instructions,
        "updated_at": row.updated_at,
    }


@router.post("/settings/logo", dependencies=[Depends(_get_current_admin)])
async def upload_logo(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(422, "Niedozwolony typ pliku. Użyj JPG, PNG, WebP lub GIF.")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(422, "Plik za duży (max 5 MB).")
    row = await _get_or_create_settings(db)
    row.logo_filename = _save_uploaded_file(content, file.content_type, row.logo_filename)
    await db.commit()
    return {"logo_filename": row.logo_filename}


@router.delete("/settings/logo", dependencies=[Depends(_get_current_admin)])
async def delete_logo(db: AsyncSession = Depends(get_db)):
    row = await _get_or_create_settings(db)
    if row.logo_filename:
        path = os.path.join(UPLOAD_DIR, row.logo_filename)
        if os.path.exists(path):
            os.remove(path)
        row.logo_filename = None
        await db.commit()
    return {"logo_filename": None}


@router.post("/settings/receipt-image", dependencies=[Depends(_get_current_admin)])
async def upload_receipt_image(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(422, "Niedozwolony typ pliku. Użyj JPG, PNG, WebP lub GIF.")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(422, "Plik za duży (max 5 MB).")
    row = await _get_or_create_settings(db)
    row.receipt_image_filename = _save_uploaded_file(content, file.content_type, row.receipt_image_filename)
    await db.commit()
    return {"receipt_image_filename": row.receipt_image_filename}


@router.delete("/settings/receipt-image", dependencies=[Depends(_get_current_admin)])
async def delete_receipt_image(db: AsyncSession = Depends(get_db)):
    row = await _get_or_create_settings(db)
    if row.receipt_image_filename:
        path = os.path.join(UPLOAD_DIR, row.receipt_image_filename)
        if os.path.exists(path):
            os.remove(path)
        row.receipt_image_filename = None
        await db.commit()
    return {"receipt_image_filename": None}


@router.put("/settings/instructions", dependencies=[Depends(_get_current_admin)])
async def update_instructions(body: InstructionsUpdate, db: AsyncSession = Depends(get_db)):
    row = await _get_or_create_settings(db)
    row.receipt_instructions = body.text or None
    await db.commit()
    return {"receipt_instructions": row.receipt_instructions}


# ---------- Import pytań ----------

def _parse_question_type(raw: str) -> tuple[str, list[str] | None]:
    """Parsuje typ pytania z formatu tekstowego. Zwraca (type, options)."""
    raw = raw.strip().lower()
    if raw == "ocena":
        return "rating", None
    if raw == "tak/nie":
        return "yesno", None
    if raw == "tekst":
        return "text", None
    if raw.startswith("wybor:"):
        opts = [o.strip() for o in raw[6:].split(",") if o.strip()]
        if not opts:
            raise ValueError("Typ 'wybor' wymaga co najmniej jednej opcji")
        return "choice", opts
    raise ValueError(f"Nieznany typ '{raw}' — użyj: ocena, tak/nie, tekst, wybor: opcja1, opcja2")


@router.post("/import/questions", dependencies=[Depends(_get_current_admin)])
async def import_questions(request: Request, db: AsyncSession = Depends(get_db)):
    """Importuje pytania z pliku tekstowego.

    Format:
        KATEGORIA: Nazwa kategorii
        Treść pytania | typ

    Typy: ocena, tak/nie, tekst, wybor: opcja1, opcja2
    Linie zaczynające się od # są ignorowane.
    """
    body_bytes = await request.body()
    try:
        content = body_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(422, "Plik musi być w kodowaniu UTF-8")

    # Załaduj wszystkie kategorie raz
    cats_result = await db.execute(select(Category))
    categories = {c.name.lower(): c for c in cats_result.scalars().all()}

    imported = 0
    skipped = 0
    errors: list[dict] = []
    current_category: Category | None = None
    position_counter = 0

    for line_no, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()

        # Pomiń komentarze, puste linie i separatory
        if not line or line.startswith("#") or line == "---":
            continue

        # Nagłówek kategorii
        if line.upper().startswith("KATEGORIA:"):
            cat_name = line[10:].strip()
            current_category = categories.get(cat_name.lower())
            if current_category is None:
                errors.append({"line": line_no, "message": f"Kategoria '{cat_name}' nie istnieje w systemie"})
            else:
                position_counter = 0
            continue

        # Linia pytania: Treść | typ
        if "|" not in line:
            errors.append({"line": line_no, "message": f"Brak separatora '|' — oczekiwano: Treść pytania | typ"})
            skipped += 1
            continue

        if current_category is None:
            errors.append({"line": line_no, "message": "Pytanie przed deklaracją KATEGORIA"})
            skipped += 1
            continue

        parts = line.split("|", maxsplit=1)
        text = parts[0].strip()
        type_raw = parts[1].strip()

        if not text:
            errors.append({"line": line_no, "message": "Treść pytania jest pusta"})
            skipped += 1
            continue

        try:
            q_type, q_options = _parse_question_type(type_raw)
        except ValueError as e:
            errors.append({"line": line_no, "message": str(e)})
            skipped += 1
            continue

        db.add(Question(
            category_id=current_category.id,
            text=text,
            type=q_type,
            options=q_options,
            position=position_counter,
            active=True,
        ))
        position_counter += 1
        imported += 1

    await db.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors}
