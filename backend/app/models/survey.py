from pydantic import BaseModel, Field


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


class SurveyAnswer(BaseModel):
    product_id: str = Field(..., max_length=100)
    product_name: str = Field("", max_length=200)
    question_id: int
    value: str = Field(..., max_length=1000)


class SurveySubmission(BaseModel):
    bill_number: str = Field(..., max_length=100)
    email: str | None = Field(None, max_length=255)
    marketing_consent: bool = False
    answers: list[SurveyAnswer] = Field(..., max_length=200)
