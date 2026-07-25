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

Usage: python3 llm_question_generation_test.py parsed_data.json

Takes in a JSON file of parsed notes data and outputs one text file per subject (e.g., chicano_studies_questions.txt) in ./output/, containing
the generated questions.

Output is parsed to keep the generated questions, with a strict generation number of 6 per subject to make model accuracy easier to test.
'''


from dotenv import load_dotenv
import os
from transformers import AutoModelForCausalLM, AutoTokenizer

load_dotenv()
hf_token = os.getenv('HF_TOKEN')

def output_format()


def build_input_context(parsed_notes: Path) -> str:
    

def main():
    model_name = "Qwen/Qwen2.5-7B-Instruct"

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype="auto",
        device_map="auto"
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    prompt = ("You are a question generator who takes in parsed notes from PDF files and creates questions on the subject matter. "
    "Each question is used to test the user on their understanding of the material. "
    "Create every question strictly based on the information explicitly stated in the provided notes. Do not include outside facts. "
    "Generate exactly 6 questions if the material supports it; if there is not enough content to generate 6 grounded questions, generate fewer questions rather"
    "than creating content. "
    "Return your output as a numbered list from 1 to 6, one question per line. "
    "After each question, include a small source excerpt from where the question is based on.")


    user_message = output_format()




if __name__ == '__main__':
    main()

