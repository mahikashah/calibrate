'''
Tests question generation quality (grounding/hallucination) from parsed notes
pasted in-context, across multiple subjects. LLM of choice for testing is
Qwen2.5-7B-Instruct via the Hugging Face inference router.

Currently testing with 4 files whose subjects are as follows:
- Chicano Studies
- Probability / Statistics
- Neuroscience / Cognitive Neuroscience
- English / Literature

Requires a .env file with HF_TOKEN to execute this script.

To use this script, generate the parsed notes per pdf from `pdf_parser_test.py`. 

Usage: python3 llm_question_generation_test.py parsed_data.json subject

Takes in a JSON file of parsed notes data and outputs one text file per subject (e.g., chicano_studies_questions.txt) in containing
the generated questions, with specification of subject to pull notes.

Output is parsed to keep the generated questions, with a strict generation number of 6 per subject to make model accuracy easier to test.
'''


from dotenv import load_dotenv
import os, sys, json
import requests

load_dotenv()
HF_TOKEN = os.getenv('HF_TOKEN')
HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"
MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"
headers = {
    "Authorization": f"Bearer {os.environ['HF_TOKEN']}",
}

SYSTEM_PROMPT = (
    "You are a question generator who takes in parsed notes from PDF files and creates "
    "questions on the subject matter. Each question is used to test the user on their "
    "understanding of the material.\n\n"
    "Create every question strictly based on the information explicitly stated in the "
    "provided notes. Do not include outside facts.\n\n"
    "Generate exactly 6 questions if the material supports it; if there is not enough "
    "content to generate 6 grounded questions, generate fewer questions rather than "
    "creating content.\n\n"
    "Each question must be one of these four types:\n"
    "- active_recall: an open-ended question testing recall of a specific fact or concept\n"
    "- mcq: a multiple-choice question with exactly 4 answer choices, one of which is correct\n"
    "- feynman: a question asking the user to explain a concept in their own words, "
    "as if teaching it to someone else\n"
    "- fill_in_blank: a sentence from or closely based on the notes with one key term "
    "replaced by a blank\n\n"
    "Choose a reasonable mix of types across the 6 questions based on what the material "
    "supports well — do not force a type onto content it doesn't fit.\n\n"
    "Return your output as a JSON array only — no other text, no introductory or closing "
    "statements, no markdown code fences. Each element must be an object with exactly "
    "these fields:\n"
    '  "type": one of "active_recall", "mcq", "feynman", "fill_in_blank"\n'
    '  "question": the question text (for fill_in_blank, include "____" where the blank goes)\n'
    '  "answer": the correct answer\n'
    '  "answer_choices": an array of exactly 4 strings if type is "mcq" (including the '
    'correct answer among them), otherwise an empty array []\n'
    '  "source_excerpt": a short, verbatim excerpt copied directly from the provided notes '
    'that this question and answer are based on — used to verify the question is grounded\n\n'
)

def build_input_context(parsed_notes: str, subject_name: str) -> str:
    with open(parsed_notes, 'r') as file:
        notes = json.load(file)

    subj_notes = [note for note in notes if note['subject'].lower().strip(",").strip() == subject_name.lower()]

    if not subj_notes:
        raise ValueError(f"No notes found for subject: {subject_name}") 
    if len(subj_notes) > 1:
        print(f"Multiple notes found for {subject_name}, using the first match")

    return subj_notes[0]['text']

def generate_questions(subject: str, notes: str) -> str:
    user_message = f"Subject:{subject}\nNotes:{notes}\n"

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": 2000,
    }
 
    try:
        response = requests.post(HF_ROUTER_URL, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"HF router request failed: {e}") from e
 
    data = response.json()
 
    finish_reason = data["choices"][0].get("finish_reason")
    if finish_reason == "length":
        print("WARNING: response was cut off by max_tokens — output may be incomplete/invalid JSON.")
 
    return data["choices"][0]["message"]["content"]


def main():
    if len(sys.argv) != 3:
            print("Usage: python3 llm_question_generation_test.py parsed_data.json subject")
            sys.exit(1)

    subject = sys.argv[2]
    subject_name = subject.replace(" ", "_").lower()
    data_file = sys.argv[1]

    file_name = f"{subject_name}_generated_questions_v2.txt"

    context_notes = build_input_context(data_file, subject)

    generated_response = generate_questions(subject, context_notes)

    try:
        questions = json.loads(generated_response)
    except json.JSONDecodeError as e:
        print(f"ERROR: model output was not valid JSON: {e}")
        print("Raw output has been saved to a .raw.txt file for inspection.")
        with open(f"{subject_name}_generated_questions.raw.txt", 'w') as f:
            f.write(generated_response)
        sys.exit(1)
 
    with open(file_name, 'w') as f:
        json.dump(questions, f, indent=2)
 

if __name__ == '__main__':
    main()

