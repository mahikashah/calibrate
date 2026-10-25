"""Request and response schemas for the Calibrate ML service."""

from typing import Literal

from pydantic import BaseModel, Field

QuestionType = Literal["active_recall", "mcq", "feynman", "fill_in_blank"]


class GenerateQuestionsRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=160)
    text: str = Field(min_length=1)
    requested_count: int = Field(default=6, ge=1, le=10)


class GeneratedQuestion(BaseModel):
    type: QuestionType
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    answer_choices: list[str]
    source_excerpt: str = Field(min_length=1)


class GenerateQuestionsResponse(BaseModel):
    questions: list[GeneratedQuestion]


class ParsePdfResponse(BaseModel):
    text: str
    word_count: int
    approx_token_count: int
    file_name: str


class ErrorResponse(BaseModel):
    success: Literal[False] = False
    code: str
    message: str