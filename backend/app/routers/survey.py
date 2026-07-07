import logging
import math
import secrets
import string
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models.db import Answer, ProductCache, Question, SurveyResponse
from app.models.survey import BillResponse, Product, SurveySubmission
from app.services.email import send_survey_code, send_survey_results
from app.services.gocrm import create_voucher
from app.services.gopos import get_bill
from app.services.questions import select_questions_for_bill

logger = logging.getLogger(__name__)
router = APIRouter()

_CODE_CHARS = string.ascii_uppercase + string.digits
_CODE_LENGTH = 8
_TOKEN_ALG = "HS256"
_TOKEN_TTL = 7200  # 2 godziny na wypełnienie ankiety


def _generate_fallback_code() -> str:
    return "".join(secrets.choice(_CODE_CHARS) for _ in range(_CODE_LENGTH))


def _create_survey_token(bill_number: str, question_ids: list[int]) -> str:
    payload = {
        "bill": bill_number,
        "qids": question_ids,
        "exp": int(time.time()) + _TOKEN_TTL,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_TOKEN_ALG)


def _verify_survey_token(token: str, bill_number: str) -> list[int]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[_TOKEN_ALG])
    except JWTError:
        raise HTTPException(400, "Nieprawidłowy lub wygasły token ankiety — odśwież stronę i zacznij od nowa")
    if payload.get("bill") != bill_number:
        raise HTTPException(400, "Token nie pasuje do numeru paragonu")
    return payload.get("qids", [])


async def _ensure_product_in_cache(product: Product, db: AsyncSession) -> None:
    if not product.gopos_product_id:
        return
    result = await db.execute(
        select(ProductCache).where(ProductCache.gopos_product_id == product.gopos_product_id)
    )
    if result.scalar_one_or_none() is None:
        db.add(ProductCache(
            gopos_product_id=product.gopos_product_id,
            category_id=None,
            name=product.name,
        ))
        logger.info("Nowy produkt w cache: %s (item_id=%s)", product.name, product.gopos_product_id)


@router.get("/bill/{bill_number}", response_model=BillResponse)
@limiter.limit("10/minute")
async def fetch_bill(bill_number: str, request: Request, db: AsyncSession = Depends(get_db)):
    already = await db.execute(
        select(SurveyResponse.id).where(SurveyResponse.fiscal_ref_id == bill_number).limit(1)
    )
    if already.scalar_one_or_none() is not None:
        bill = await get_bill(bill_number)
        bill.already_submitted = True
        return bill

    bill = await get_bill(bill_number)

    for product in bill.products:
        await _ensure_product_in_cache(product, db)

    await db.commit()

    distributed = await select_questions_for_bill(bill.products, db)
    for product in bill.products:
        product.questions = distributed.get(product.id, [])

    # Podpisany token z listą pytań — weryfikowany przy submit
    all_qids = [
        q["id"] if isinstance(q, dict) else q.id
        for product in bill.products
        for q in product.questions
    ]
    bill.survey_token = _create_survey_token(bill_number, all_qids)

    return bill


@router.post("/submit")
@limiter.limit("3/minute")
async def submit_survey(submission: SurveySubmission, request: Request, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(SurveyResponse.id).where(SurveyResponse.fiscal_ref_id == submission.bill_number).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Ankieta dla tego paragonu została już wypełniona")

    # Weryfikacja tokenu i sprawdzenie wypełnienia 80% pytań
    if not submission.survey_token:
        raise HTTPException(400, "Brak tokenu ankiety — wypełnij formularz przez stronę")

    question_ids = _verify_survey_token(submission.survey_token, submission.bill_number)
    if question_ids:
        answered_ids = {ans.question_id for ans in submission.answers}
        covered = len(answered_ids & set(question_ids))
        required = math.ceil(len(question_ids) * 0.8)
        if covered < required:
            raise HTTPException(
                400,
                f"Wypełnij co najmniej 80% ankiety — udzielono {covered} z {len(question_ids)} odpowiedzi (wymagane: {required})"
            )

    crm_code = await create_voucher(source_reference_id=submission.bill_number)
    code = crm_code or _generate_fallback_code()

    survey_response = SurveyResponse(
        fiscal_ref_id=submission.bill_number,
        gopos_order_number=None,
        email=submission.email or None,
        code=code,
        marketing_consent=submission.marketing_consent,
    )
    db.add(survey_response)
    await db.flush()

    answers_dicts = []
    for ans in submission.answers:
        q_result = await db.execute(select(Question).where(Question.id == ans.question_id))
        question = q_result.scalar_one_or_none()
        if not question:
            continue
        db.add(Answer(
            response_id=survey_response.id,
            product_id=ans.product_id,
            product_name=ans.product_name,
            question_id=ans.question_id,
            question_text=question.text,
            value=str(ans.value),
        ))
        answers_dicts.append({
            "product_name": ans.product_name or ans.product_id,
            "question_text": question.text,
            "value": str(ans.value),
        })

    await db.commit()

    logger.info("Paragon %s — email: %s, kod: %s", submission.bill_number, submission.email or "(brak)", code)

    if submission.email:
        try:
            await send_survey_code(submission.email, code)
        except Exception:
            logger.exception("Błąd wysyłki emaila dla paragonu %s", submission.bill_number)

    try:
        await send_survey_results(
            bill_number=submission.bill_number,
            customer_email=submission.email,
            answers=answers_dicts,
            code=code,
        )
    except Exception:
        logger.exception("Błąd wysyłki wyników ankiety #%s", submission.bill_number)

    return {
        "status": "ok",
        "message": "Dziękujemy za wypełnienie ankiety!",
        "response_id": survey_response.id,
        "code": code,
    }
