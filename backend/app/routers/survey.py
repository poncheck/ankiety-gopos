import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db import Answer, ProductCache, Question, SurveyResponse
from app.models.survey import BillResponse, Product, SurveySubmission
from app.services.gopos import get_bill
from app.services.questions import get_questions_for_product

logger = logging.getLogger(__name__)
router = APIRouter()


async def _ensure_product_in_cache(product: Product, db: AsyncSession) -> None:
    """Rejestruje produkt w product_cache jeśli jeszcze go tam nie ma.
    Kategorię trzeba ustawić przez sync_items lub ręcznie w adminie."""
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
async def fetch_bill(bill_number: str, db: AsyncSession = Depends(get_db)):
    """Pobiera dane rachunku z GoPOS i zwraca listę produktów z pytaniami ankiety."""
    bill = await get_bill(bill_number)

    for product in bill.products:
        await _ensure_product_in_cache(product, db)

    await db.commit()

    for product in bill.products:
        product.questions = await get_questions_for_product(product.gopos_product_id, db)

    return bill


@router.post("/submit")
async def submit_survey(submission: SurveySubmission, db: AsyncSession = Depends(get_db)):
    """Zapisuje wypełnioną ankietę do bazy danych."""
    survey_response = SurveyResponse(
        fiscal_ref_id=submission.bill_number,
        gopos_order_number=None,
    )
    db.add(survey_response)
    await db.flush()

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

    await db.commit()

    return {
        "status": "ok",
        "message": "Dziękujemy za wypełnienie ankiety!",
        "response_id": survey_response.id,
    }
