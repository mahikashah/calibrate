"""FastAPI entry point for the isolated Calibrate ML service."""

from hmac import compare_digest

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import get_settings
from app.pdf_parser import PdfParseError, UnsupportedPdfError, parse_pdf_bytes
from app.question_generator import (
    GenerationError,
    ModelResponseError,
    ModelTimeoutError,
    generate_questions,
)
from app.schemas import (
    ErrorResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    GeneratedQuestion,
    ParsePdfResponse,
)

app = FastAPI(
    title="Calibrate ML Service",
    version="0.1.0",
    description="Isolated PDF parsing and grounded-question generation service.",
)


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "code": code, "message": message},
    )


async def require_service_key(
    x_ml_service_key: str | None = Header(default=None),
) -> None:
    configured_key = get_settings().service_api_key
    if configured_key and (
        not x_ml_service_key or not compare_digest(x_ml_service_key, configured_key)
    ):
        raise HTTPException(status_code=401, detail="Invalid ML service key.")


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exception: HTTPException) -> JSONResponse:
    if exception.status_code == 401:
        return error_response(401, "UNAUTHORIZED", "Invalid ML service key.")
    return error_response(exception.status_code, "REQUEST_FAILED", "Request failed.")


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post(
    "/parse-pdf",
    response_model=ParsePdfResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def parse_pdf(
    file: UploadFile = File(...),
    _: None = Depends(require_service_key),
):
    file_name = file.filename or "upload.pdf"
    is_pdf = file.content_type == "application/pdf" or file_name.lower().endswith(".pdf")
    if not is_pdf:
        return error_response(400, "PDF_PARSE_FAILED", "Please upload a PDF file.")

    try:
        parsed = parse_pdf_bytes(await file.read())
    except UnsupportedPdfError:
        return error_response(
            422,
            "UNSUPPORTED_PDF",
            "This PDF appears to be scanned. Please use a text-based PDF or paste your notes.",
        )
    except PdfParseError:
        return error_response(
            422,
            "PDF_PARSE_FAILED",
            "We couldn't read this PDF. Please try a different file.",
        )

    return ParsePdfResponse(file_name=file_name, **parsed.__dict__)


def validate_questions(raw_questions: list[dict]) -> list[GeneratedQuestion]:
    validated: list[GeneratedQuestion] = []
    for raw_question in raw_questions:
        try:
            question = GeneratedQuestion.model_validate(raw_question)
        except ValidationError as error:
            raise ModelResponseError from error

        if question.type == "mcq":
            if (
                len(question.answer_choices) != 4
                or any(not choice.strip() for choice in question.answer_choices)
                or question.answer not in question.answer_choices
            ):
                raise ModelResponseError
        elif question.answer_choices != []:
            raise ModelResponseError
        validated.append(question)
    return validated


@app.post(
    "/generate-questions",
    response_model=GenerateQuestionsResponse,
    responses={
        401: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        504: {"model": ErrorResponse},
    },
)
async def generate(
    request: GenerateQuestionsRequest,
    _: None = Depends(require_service_key),
):
    settings = get_settings()
    if len(request.text.split()) > settings.word_limit:
        return error_response(
            413,
            "NOTES_TOO_LONG",
            "Your notes are too long. Please use one lecture, chapter, or study section at a time.",
        )

    try:
        raw_questions = generate_questions(
            request.subject, request.text, request.requested_count, settings
        )
        questions = validate_questions(raw_questions)
    except ModelTimeoutError:
        return error_response(
            504,
            "MODEL_TIMEOUT",
            "The question generator is taking too long. Please try again.",
        )
    except ModelResponseError:
        return error_response(
            502,
            "INVALID_MODEL_RESPONSE",
            "The question generator returned an unexpected result. Please try again.",
        )
    except GenerationError:
        return error_response(
            502,
            "GENERATION_FAILED",
            "Question generation failed. Please try again.",
        )

    return GenerateQuestionsResponse(questions=questions)