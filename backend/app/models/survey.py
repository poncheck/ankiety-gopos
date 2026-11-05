import re

from pydantic import BaseModel, Field, field_validator

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class Question(BaseModel):
    id: int
    text: str
    type: str
    options: list[str] | None = None


class Product(BaseModel):
    id: str
    gopos_product_id: int | None = None
    gopos_category_id: int | None = None
    name: str
    quantity: float
    price: float
    questions: list[Question] = []


class BillResponse(BaseModel):
    bill_number: str
    products: list[Product]
    general_questions: list[Question] = []
    general_category_name: str | None = None
    already_submitted: bool = False
    survey_token: str | None = None


class SurveyAnswer(BaseModel):
    product_id: str = Field(..., max_length=100)
    product_name: str = Field("", max_length=200)
    question_id: int
    value: str = Field(..., max_length=1000)


class SurveySubmission(BaseModel):
    bill_number: str = Field(..., max_length=100)
    email: str = Field(..., max_length=255, min_length=5)
    marketing_consent: bool = False
    answers: list[SurveyAnswer] = Field(..., max_length=200)
    survey_token: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Podaj poprawny adres e-mail — kod rabatowy jest wysyłany tylko mailem")
        return v
