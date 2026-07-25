'''
Working script to parse PDF files uploaded in notes upload, create .json file to pass into the LLM as context. 
Currently testing with 4 files whose subjects are as follows:
- Chicano Studies
- Probability / Statistics
- Neuroscience / Cognitive Neuroscience
- English / Literature

Usage: python3 llm_question_generation_test /path/to/notes/folder /path/to/subjects/file output.json 

This tests the most simple case: each subject in subjects file is corresponding to one notes file in the notes folder in order

Output JSON structure would be as follows:
[
  {
    "id": "biology_cell_structure",
    "subject": "biology",          # currently reading from another saved subjects file to simulate how MVP may save subject data
    "filename": "biology_cell_structure.pdf",
    "text": "...",
    "word_count": 812,
    "approx_tokens": 1070    # using an approximation of 1.33 tokens / word
  },
  ...
]
'''

import sys
import json
import re
from pathlib import Path
import pdfplumber


def extract_text(pdf_path: Path) -> str:
    text = []
    with pdfplumber.open(pdf_path) as file:
        for page in file.pages:
            text_page = page.extract_text()
            if text_page:
                text.append(text_page)
    return '\n'.join(text)

def extract_subjects(subject_file: Path) -> list:
    subjects_extracted = []
    with open(subject_file, 'r') as s_file:
        for line in s_file:
            subjects_extracted.append(line.strip())
    return subjects_extracted

def clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()




def main():
    if len(sys.argv) != 4:
        print("Usage: python extract_notes.py <pdf_folder> <subjects_file> <output.json>")
        sys.exit(1)

    folder_notes = Path(sys.argv[1])
    subjects_file = Path(sys.argv[2])
    export_file = Path(sys.argv[3])

    if not folder_notes.is_dir():
        print(f"Not a directory: {folder_notes}")
        sys.exit(1)

    pdf_files = sorted(folder_notes.glob('*.pdf'))
    if not pdf_files:
        print(f"No PDF files found in {folder_notes}")
        sys.exit(1)

    subjects = extract_subjects(subjects_file)

    text_per_file = []
    for i, file in enumerate(pdf_files):
        print(f"Processing {file.name}...")
        raw_text = extract_text(file)
        if not raw_text.strip():
            print(f"WARNING: No extractable text was found in file {file}. Skipping processing of {file}")
            continue
        cleaned_data = clean_text(raw_text)
        word_count = len(cleaned_data.split())
        approx_token_count = int(word_count * 1.33)

        text_per_file.append({
            'id' : file.stem,
            'subject' : subjects[i],
            "file_name" : file.name, 
            'text' : cleaned_data,
            'word_count' : approx_token_count
        })

    with open(export_file, 'w') as o_file:
        json.dump(text_per_file, o_file, indent = 1)

    print(f"\nDone. Extracted {len(text_per_file)} notes to {export_file}")



if __name__ == "__main__":
    main()
