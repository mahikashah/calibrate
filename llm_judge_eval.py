"""
LLM-as-judge eval: scores generated questions for groundedness and quality
by feeding the RAW generated text + source notes directly to a judge model.
 
Usage:
    python3 llm_judge_eval.py parsed_data.json generated_output_dir/ eval_results.csv
 
Requires .env with HF_TOKEN (same setup as generation script).
 
IMPORTANT: uses a different/larger model than the generator (DeepSeek-V3)
to avoid the judge grading its own output too charitably. Judge model can be 
changed by editing the JUDGE_MODEL parameter
"""

import sys
import json
import sys
import json
import csv
import os
import re
from pathlib import Path
from dotenv import load_dotenv
import requests
import difflib

load_dotenv()
hf_token = os.getenv('HF_TOKEN')
HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"
MODEL_NAME = "deepseek-ai/DeepSeek-V3-0324"
headers = {
    "Authorization": f"Bearer {os.environ['HF_TOKEN']}",
}

JUDGE_SYSTEM_PROMPT = (
    "You are a strict evaluator of AI-generated study questions. You will be given "
    "FULL_SOURCE_NOTES (the student's complete notes for this subject) and a JSON array "
    "of generated questions, each with a source_excerpt, question_type, question, answer, "
    "and answer_choices.\n\n"
    "For EACH question in the array, judge three things:\n"
    "1. GROUNDED: does the question and answer follow strictly from the FULL_SOURCE_NOTES "
    "(using the excerpt as the claimed basis, but checking against the full notes for "
    "context), with no invented facts, numbers, or claims not present in the notes? Also "
    "flag NOT_GROUNDED if the excerpt is taken out of context in a way that makes the "
    "question/answer misleading. Answer GROUNDED, PARTIAL, or NOT_GROUNDED.\n"
    "2. CORRECT: independent of grounding, does the ANSWER actually and accurately answer "
    "the QUESTION as asked? For mcq, is the marked answer the right choice among "
    "answer_choices? Answer CORRECT or INCORRECT.\n"
    "3. WELL_FORMED: is this a clear, specific, answerable question testing real "
    "understanding (not trivial or vague)? For mcq, are answer_choices plausible "
    "distractors? Answer WELL_FORMED or WEAK.\n\n"
    "Return ONLY a JSON array, one object per question, in the same order as the input, "
    "with exactly these fields: \"question_number\" (1-indexed position in the input array), "
    "\"grounded\", \"correct\", \"well_formed\", \"reason\" (one short sentence). "
    "No other text, no markdown code fences."
)

def load_notes(file_name: str) -> dict:
    with open(file_name, 'r') as f:
        notes = json.load(f)
    return {n['subject'].lower().strip(',') : n['text'] for n in notes}

def excerpt_appears_in_notes(excerpt: str, notes: str, threshold: float = 0.85) -> bool:
    """
    Fast pre-check: does source_excerpt approximately appear in notes?
    Uses a sliding window + difflib ratio rather than requiring an exact
    substring match, since models sometimes lightly reword excerpts.
    """
    excerpt = excerpt.strip()
    if not excerpt:
        return False  
    if excerpt.lower() in notes.lower():
        return True
 
    window = len(excerpt) + 40
    best_ratio = 0.0
    notes_lower = notes.lower()
    excerpt_lower = excerpt.lower()
    step = max(1, window // 2)
    for i in range(0, max(1, len(notes_lower) - window), step):
        chunk = notes_lower[i:i + window]
        ratio = difflib.SequenceMatcher(None, excerpt_lower, chunk).ratio()
        best_ratio = max(best_ratio, ratio)
        if best_ratio >= threshold:
            return True
    return best_ratio >= threshold

def extract_json_array(raw: str) -> str:
    """
    Strips markdown code fences and any leading/trailing prose the model
    added despite instructions not to, then returns just the JSON array
    substring (from the first '[' to the last ']').
    """
    text = raw.strip()
 
    if "```" in text:
        # Grab whatever is between the first pair of triple backticks
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
            if text.strip().lower().startswith("json"):
                text = text.strip()[4:]
 
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
 
    return text.strip()

def judge_subject_batch(notes: str, questions: list, max_retries: int = 2) -> list:
    user_message = (
        f"FULL_SOURCE_NOTES:\n{notes}\n\n"
        f"GENERATED QUESTIONS (JSON array):\n{json.dumps(questions, indent=2)}"
    )
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": 1200,
        "temperature": 0.2,       
        "frequency_penalty": 0.4,  
    }
    headers = {"Authorization": f"Bearer {hf_token}"}
 
    for attempt in range(1, max_retries + 2):  
        try:
            response = requests.post(HF_ROUTER_URL, headers=headers, json=payload, timeout=90)
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            print(f"HTTP error: {e}")
            print(f"Response body: {response.text}")
            raise
 
        data = response.json()
        finish_reason = data["choices"][0].get("finish_reason")
        raw = data["choices"][0]["message"]["content"]
        cleaned = extract_json_array(raw)
 
        try:
            result = json.loads(cleaned)
            return result
        except json.JSONDecodeError as e:
            print(
                f"WARNING (attempt {attempt}/{max_retries + 1}): judge output was not "
                f"valid JSON ({e}), finish_reason={finish_reason}."
            )
            if attempt <= max_retries:
                print("Retrying...")
                continue
            print(f"Giving up after {attempt} attempts. Raw output:\n{raw[:500]}")
            return []
 
def main():
    if len(sys.argv) != 4:
        print("Usage: python3 llm_judge_eval.py parsed_data.json generated_output_dir/ eval_results.csv")
        sys.exit(1)
 
    if not hf_token:
        print("ERROR: HF_TOKEN not found. Check your .env file.")
        sys.exit(1)

    data_path = sys.argv[1]
    questions_dir = Path(sys.argv[2])
    output_path = sys.argv[3]

    all_notes = load_notes(data_path)
    all_rows = []

    for file in sorted(questions_dir.glob("*generated_questions_v2.json")):
        subj_name = file.stem.replace("_generated_questions_v2", "").replace("_", " ")
        with open(file, 'r') as f:
            questions = json.load(f)

        notes_subj = all_notes.get(subj_name.lower(), "")

        if not notes_subj:
            print(f"WARNING: no notes found for subject '{subj_name}', skipping.")
            continue
 
        print(f"Judging {subj_name} ({len(questions)} questions, 1 batched call)...")

        excerpt_checks = [
            excerpt_appears_in_notes(q.get("source_excerpt", ""), notes_subj) for q in questions
        ]
 
        judged_batch = judge_subject_batch(notes_subj, questions)
        judged_by_number = {j.get("question_number"): j for j in judged_batch}
 
        for i, item in enumerate(questions, start=1):
            judged = judged_by_number.get(i, {})
            all_rows.append({
                "subject": subj_name,
                "question_number": i,
                "type": item.get("type", ""),
                "question": item.get("question", ""),
                "excerpt_found_in_notes": excerpt_checks[i - 1],
                "grounded": judged.get("grounded", "MISSING"),
                "correct": judged.get("correct", "MISSING"),
                "well_formed": judged.get("well_formed", "MISSING"),
                "judge_reason": judged.get("reason", ""),
            })
 
    fieldnames = [
        "subject", "question_number", "type", "question",
        "excerpt_found_in_notes", "grounded", "correct", "well_formed", "judge_reason",
    ]
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)
 
    print(f"\nWrote {len(all_rows)} judged rows to {output_path}")
 
    total = len(all_rows)
    if total:
        grounded_count = sum(1 for r in all_rows if r["grounded"] == "GROUNDED")
        correct_count = sum(1 for r in all_rows if r["correct"] == "CORRECT")
        excerpt_ok_count = sum(1 for r in all_rows if r["excerpt_found_in_notes"])
        print(f"Grounded (LLM judge): {grounded_count}/{total} ({grounded_count/total:.0%})")
        print(f"Correct (LLM judge): {correct_count}/{total} ({correct_count/total:.0%})")
        print(f"Excerpt found in notes (pre-check): {excerpt_ok_count}/{total} ({excerpt_ok_count/total:.0%})")

if __name__ == '__main__':
    main()