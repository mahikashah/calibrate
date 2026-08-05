"""
LLM-as-judge eval: scores generated questions for groundedness and quality
by feeding the RAW generated text + source notes directly to a judge model.
 
Usage:
    python3 llm_judge_eval.py parsed_data.json generated_output_dir/ eval_results.csv
 
Requires .env with HF_TOKEN (same setup as generation script).
 
IMPORTANT: uses a different/larger model than the generator (Qwen2.5-7B)
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

load_dotenv()
hf_token = os.getenv('HF_TOKEN')
HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"
MODEL_NAME = "mistralai/Mixtral-8x7B-Instruct-v0.1"
headers = {
    "Authorization": f"Bearer {os.environ['HF_TOKEN']}",
}

JUDGE_PROMPT = (
    "You are a strict evaluator of AI-generated study questions. "
    "You will be given SOURCE NOTES and a block of GENERATED QUESTIONS (which may include answers " \
    "in an inconsistent format). For EACH distinct question in the generated block, you will evaluate the question against" \
    "the source notes provided and output one line in this exact format:\n\n" \
    "N | GROUNDED|PARTIAL|NOT_GROUNDED WELL_FORMED|WEAK | one-line reason\n\n " \
    "Where N is the question number. GROUNDED refers to "
)

def load_notes(file_name: str) -> dict:
    with open(file_name, 'r') as f:
        notes = json.load(f)
    return {n['subject'].lower().strip(',') : n['text'] for n in notes}

def judge_batch(subject: str, notes: str, raw_gen_text: str) -> str:
    user_message = (f"SOURCE NOTES (subject: {subject}):\n{notes}\n\n"
                    f"GENERATED QUESTIONS:\n{raw_gen_text}")

    payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": JUDGE_PROMPT},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": 512,
    }

    response = requests.post(HF_ROUTER_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
     
    data = response.json()
    return data["choices"][0]["message"]["content"]