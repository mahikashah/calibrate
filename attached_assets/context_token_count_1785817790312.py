'''
Script for returning token count for context using the test model (Qwen2.5-7B).

Usage: python3 context_token_count.py parsed_data.json token_count.csv

Script outputs a file containing the subject and the number of tokens used for the user message in the format of:

f"Subject:{subject}\nNotes:{notes}\n"

'''

from transformers import AutoTokenizer
import json, sys
import csv

tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct")

def count_tokens(text: str) -> int:
    return len(tokenizer.encode(text))


def main():
    notes_json = sys.argv[1]
    output_file = sys.argv[2]

    with open(notes_json, 'r') as file:
        parsed = json.load(file)

    token_per_subject = {}
    for subj in parsed:
        name = subj['subject']
        notes = subj['text']
        user_message = f"Subject:{name}\nNotes:{notes}\n"
        token_amount = count_tokens(user_message)
        token_per_subject[name] = token_amount

    with open(output_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["subject", "token_count"])
        for name, count in token_per_subject.items():
            writer.writerow([name, count])

    print(f"Saved token counts to {output_file}")

if __name__ == '__main__':
    main()





