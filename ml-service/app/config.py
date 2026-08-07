"""Runtime configuration for the ML service."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    hf_token: str | None
    hf_model: str
    hf_endpoint: str
    generation_timeout_seconds: int
    word_limit: int
    service_api_key: str | None


def _positive_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


def get_settings() -> Settings:
    return Settings(
        hf_token=os.getenv("HF_TOKEN") or None,
        hf_model=os.getenv("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct"),
        hf_endpoint=os.getenv(
            "HF_ENDPOINT", "https://router.huggingface.co/v1/chat/completions"
        ),
        generation_timeout_seconds=_positive_int("GENERATION_TIMEOUT_SECONDS", 90),
        word_limit=_positive_int("WORD_LIMIT", 4600),
        service_api_key=os.getenv("ML_SERVICE_API_KEY") or None,
    )