"""Hugging Face / Qwen generation adapted from Shreya's CLI production script."""

import json
import re

import requests

from app.config import Settings


class ModelTimeoutError(Exception):
    """The provider did not respond before the configured timeout."""


class ModelResponseError(Exception):
    """The provider returned malformed or truncated question JSON."""


class GenerationError(Exception):
    """The provider request could not be completed."""


def build_messages(subject: str, text: str, requested_count: int) -> list[dict[str, str]]:
    """Preserves Shreya's notes-only structured generation instructions."""
    prompt = f"""Generate up to {requested_count} study questions from the notes below.
Use only the supplied notes. Do not add outside knowledge or invent facts.

Use these types where the material supports them:
- active_recall
- mcq
- feynman
- fill_in_blank

For every question, return exactly these fields:
- type
- question
- answer
- answer_choices
- source_excerpt

For an mcq, answer_choices must contain exactly 4 options and answer must exactly
match one option. For all other types, answer_choices must be [].
source_excerpt must be a verbatim supporting excerpt from the notes.

Return JSON only: a JSON array of question objects. Do not use markdown.
If the notes do not support {requested_count} valid questions, return fewer.

Subject:{subject}
Notes:{text}
"""
    return [
        {
            "role": "system",
            "content": "You create grounded study questions from supplied notes.",
        },
        {"role": "user", "content": prompt},
    ]


def _extract_json_array(content: str) -> list[dict]:
    match = re.search(r"\[[\s\S]*\]", content)
    if not match:
        raise ModelResponseError
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError as error:
        raise ModelResponseError from error
    if not isinstance(parsed, list):
        raise ModelResponseError
    return parsed


def generate_questions(
    subject: str, text: str, requested_count: int, settings: Settings
) -> list[dict]:
    """Call Shreya's existing HF/Qwen provider contract and parse its JSON."""
    if not settings.hf_token:
        raise GenerationError

    payload = {
        "model": settings.hf_model,
        "messages": build_messages(subject, text, requested_count),
        "max_tokens": 2000,
    }
    headers = {
        "Authorization": f"Bearer {settings.hf_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            settings.hf_endpoint,
            headers=headers,
            json=payload,
            timeout=settings.generation_timeout_seconds,
        )
        response.raise_for_status()
        body = response.json()
    except requests.Timeout as error:
        raise ModelTimeoutError from error
    except (requests.RequestException, ValueError) as error:
        raise GenerationError from error

    try:
        choice = body["choices"][0]
        if choice.get("finish_reason") == "length":
            raise ModelResponseError
        content = choice["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise ModelResponseError from error
    return _extract_json_array(content)