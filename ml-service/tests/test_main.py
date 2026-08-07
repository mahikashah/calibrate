from io import BytesIO

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_ACTIVE_RECALL = {
    "type": "active_recall",
    "question": "What does the note explain?",
    "answer": "It explains the core concept.",
    "answer_choices": [],
    "source_excerpt": "The core concept is explained here.",
}
VALID_MCQ = {
    "type": "mcq",
    "question": "Which option is correct?",
    "answer": "Correct answer",
    "answer_choices": ["Incorrect A", "Correct answer", "Incorrect C", "Incorrect D"],
    "source_excerpt": "Correct answer appears in these notes.",
}


def request_body(**overrides):
    return {
        "subject": "Neuroscience",
        "text": "The core concept is explained here.",
        "requested_count": 6,
        **overrides,
    }


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_valid_generation_with_mock(monkeypatch):
    monkeypatch.setattr(
        "app.main.generate_questions", lambda *_: [VALID_ACTIVE_RECALL, VALID_MCQ]
    )
    response = client.post("/generate-questions", json=request_body())
    assert response.status_code == 200
    assert response.json()["questions"][1]["answer"] == "Correct answer"


def test_requested_count_validation():
    assert client.post("/generate-questions", json=request_body(requested_count=0)).status_code == 422
    assert client.post("/generate-questions", json=request_body(requested_count=11)).status_code == 422


def test_empty_text_validation():
    assert client.post("/generate-questions", json=request_body(text="")).status_code == 422


def test_notes_too_long():
    response = client.post("/generate-questions", json=request_body(text="word " * 4601))
    assert response.status_code == 413
    assert response.json()["code"] == "NOTES_TOO_LONG"


def test_mcq_answer_not_in_choices_is_rejected(monkeypatch):
    invalid_mcq = {**VALID_MCQ, "answer": "Not one of the choices"}
    monkeypatch.setattr("app.main.generate_questions", lambda *_: [invalid_mcq])
    response = client.post("/generate-questions", json=request_body())
    assert response.status_code == 502
    assert response.json()["code"] == "INVALID_MODEL_RESPONSE"


def test_non_mcq_choices_are_rejected(monkeypatch):
    invalid_question = {**VALID_ACTIVE_RECALL, "answer_choices": ["Unexpected"]}
    monkeypatch.setattr("app.main.generate_questions", lambda *_: [invalid_question])
    response = client.post("/generate-questions", json=request_body())
    assert response.status_code == 502
    assert response.json()["code"] == "INVALID_MODEL_RESPONSE"


def test_malformed_model_response_is_rejected(monkeypatch):
    monkeypatch.setattr(
        "app.main.generate_questions",
        lambda *_: [{"type": "active_recall", "question": "Missing fields"}],
    )
    response = client.post("/generate-questions", json=request_body())
    assert response.status_code == 502
    assert response.json()["code"] == "INVALID_MODEL_RESPONSE"


def test_pdf_without_extractable_text(monkeypatch):
    from app.pdf_parser import UnsupportedPdfError

    monkeypatch.setattr(
        "app.main.parse_pdf_bytes",
        lambda _: (_ for _ in ()).throw(UnsupportedPdfError()),
    )
    response = client.post(
        "/parse-pdf",
        files={"file": ("scan.pdf", BytesIO(b"pdf"), "application/pdf")},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "UNSUPPORTED_PDF"


def test_service_key_when_configured(monkeypatch):
    from app.config import Settings

    monkeypatch.setattr(
        "app.main.get_settings",
        lambda: Settings(
            hf_token=None,
            hf_model="test",
            hf_endpoint="https://example.test",
            generation_timeout_seconds=90,
            word_limit=4600,
            service_api_key="test-service-key",
        ),
    )
    assert client.post("/generate-questions", json=request_body()).status_code == 401
    monkeypatch.setattr("app.main.generate_questions", lambda *_: [VALID_ACTIVE_RECALL])
    response = client.post(
        "/generate-questions",
        json=request_body(),
        headers={"X-ML-Service-Key": "test-service-key"},
    )
    assert response.status_code == 200