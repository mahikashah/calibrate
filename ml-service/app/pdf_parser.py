"""PDF extraction adapted from Shreya's pdf_parser.py production script."""

import re
from dataclasses import dataclass
from io import BytesIO

import pdfplumber


class PdfParseError(Exception):
    """The uploaded file could not be opened or read as a PDF."""


class UnsupportedPdfError(Exception):
    """The PDF has no extractable text, usually because it is scanned."""


@dataclass(frozen=True)
class ParsedPdf:
    text: str
    word_count: int
    approx_token_count: int


def clean_text(text: str) -> str:
    """Preserve Shreya's whitespace normalization behavior."""
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def parse_pdf_bytes(content: bytes) -> ParsedPdf:
    """Extract and normalize text from a text-based PDF."""
    try:
        with pdfplumber.open(BytesIO(content)) as document:
            pages = [page.extract_text() for page in document.pages]
    except Exception as error:
        raise PdfParseError from error

    extracted_text = "\n".join(page for page in pages if page)
    normalized_text = clean_text(extracted_text)
    if not normalized_text:
        raise UnsupportedPdfError

    word_count = len(normalized_text.split())
    return ParsedPdf(
        text=normalized_text,
        word_count=word_count,
        approx_token_count=int(word_count * 1.33),
    )