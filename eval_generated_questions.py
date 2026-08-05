'''
Eval harness for generated questions.
 
Reads the raw generated output (per subject .txt files) plus the source notes,
and produces a CSV where you manually fill in scores per question while
reviewing them side-by-side with the source.
 
Usage:
    python3 build_eval_sheet.py parsed_data.json generated_output_dir/ eval_sheet.csv
 
This does NOT auto-score quality (that requires human judgment or a second
LLM-as-judge pass — see notes below). It parses the generated questions into
structured rows and pairs each with its subject's full notes, so you can
review and fill in the score columns quickly.
'''


import csv, json, sys, re
from pathlib import Path


def load_notes(file_name: str) -> dict:
    with open(file_name, 'r') as f:
        notes = json.load(f)
    return {n['subject'].lower().strip(',') : n['text'] for n in notes}

def parse_generated_questions(text: str) -> list[dict]:
    """
    Parses numbered-list output like:
        1. What is X?
        - Answer text here
    or:
        1. What is X? - Answer text here
    into a list of {number, question, answer, source_excerpt} dicts.
    """
    blocks = re.split(r'\n(?=\d+\.\s)', text.strip())
    parsed = []
    for block in blocks:
        match = re.match(r'(\d+)\.\s*(.+)', block, re.DOTALL)
        if not match:
            continue
        number, rest = match.groups()

        qmark_split = re.search(r'\?\s*\n+\s*', rest)
        if qmark_split:
            question_part = rest[:qmark_split.start() + 1].strip()  # keep the "?"
            answer_part = rest[qmark_split.end():].strip()
        elif '\n' in rest.strip():
            lines = rest.strip().split('\n', 1)
            question_part = lines[0].strip()
            answer_part = lines[1].strip() if len(lines) > 1 else ""
        else:
            question_part = rest.strip()
            answer_part = ""
 
        parsed.append({
            "number": number.strip(),
            "question": question_part.strip(),
            "answer": answer_part
        })
    return parsed

def main():
    if len(sys.argv) != 4:
        print("Usage: python3 build_eval_sheet.py parsed_data.json generated_output_dir/ eval_sheet.csv")
        sys.exit(1)

    parsed_data_file = sys.argv[1]
    generated_answers = Path(sys.argv[2])
    eval_output_path = sys.argv[3]
    notes_reference = load_notes(parsed_data_file)

    rows = []
    for txt in sorted(generated_answers.glob("*_generated_questions.txt")):
        subject_name = txt.stem.replace("_generated_questions.txt", "")

        with open(txt, 'r') as f:
            raw_qs = f.read()

        questions = parse_generated_questions(raw_qs)
        subj_notes = notes_reference.get(subject_name, "")

        for q in questions:
            rows.append({
                "subject" : subject_name,
                "question_number" : q["number"],
                "question" : q['question'], 
                "grounded_yes_no_partial" : "",
                "well_formed_yes_no" : "",
                "subject_notes" : subj_notes
            })

    field_names = [
        "subject", "question_number", "question", "grounded_yes_no_partial", "well_formed_yes_no", "subject_notes"
    ]

    with open(eval_output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=field_names)
        writer.writeheader()
        writer.writerows(rows)
 
    print(f"Wrote {len(rows)} questions to {eval_output_path} for manual scoring.")
    








if __name__ == "__main__":
    main()