from flask import Blueprint, request, jsonify
from pdf2image import convert_from_path
import os
import pytesseract
import cv2
import numpy as np
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import torch
import re
import json
from dateutil import parser
import pandas as pd
from openai import OpenAI
import pathlib
import numpy as np

# ---------------- Blueprint Definition ----------------
details_bp = Blueprint('details_bp', __name__)

APP_ROOT = pathlib.Path(__file__).parent.parent.resolve()
print(f"Details Blueprint: APP_ROOT resolved to: {APP_ROOT}")

BASE_DATA_FOLDER = str(APP_ROOT)
UPLOAD_FOLDER = str(APP_ROOT / "uploads")
IMG_ROOT = str(APP_ROOT / "pages")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(IMG_ROOT, exist_ok=True)

# ---------------- TrOCR Model ----------------
processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
model.eval()

# ---------------- OCR Functions ----------------
def printed_ocr(image):
    img = np.array(image)
    if len(img.shape) == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    img = cv2.resize(img, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (5,5), 0)
    _, img = cv2.threshold(img,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    return pytesseract.image_to_string(img, config='--oem 3 --psm 6')

def handwritten_ocr(image):
    image = image.convert("RGB")
    pixel_values = processor(image, return_tensors="pt").pixel_values
    with torch.no_grad():
        generated_ids = model.generate(pixel_values)
    return processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

# ---------------- Helper Functions ----------------
def regex_extract(text):
    result = {}
    
    m = re.search(r"(Instrument|Doc|Document)\s*(No\.?|#)?\s*([A-Z0-9]+)", text, re.I)
    if m:
        result["INSTRUMENT_NUMBER"] = m.group(3) if m.lastindex >= 3 else m.group()
    
    consideration_patterns = [
        r"(?:Consideration|consideration)[:\s]+\$?\s*([\d,]+\.?\d{0,2})",
        r"(?:for\s+(?:the\s+)?(?:sum|consideration)\s+of)[:\s]+\$?\s*([\d,]+\.?\d{0,2})",
        r"(?:sum\s+of)[:\s]+\$?\s*([\d,]+\.?\d{0,2})",
    ]
    for pattern in consideration_patterns:
        m = re.search(pattern, text, re.I)
        if m:
            result["CONSIDERATION_AMOUNT"] = "$" + m.group(1)
            break
    
    m = re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", text, re.I)
    if m:
        result["RECORDING_DATE"] = m.group()
    
    book_page_pattern = r"\bBook\s*[:#]?\s*(\d+)\s*[,\s]*Page\s*[:#]?\s*(\d+)"
    m = re.search(book_page_pattern, text, re.I)
    if m:
        result["BOOK"] = m.group(1)
        result["PAGENO"] = m.group(2)

    return result

def extract_json(text):
    stack = []
    start = None
    for i,c in enumerate(text):
        if c == "{":
            if not stack:
                start = i
            stack.append(c)
        elif c == "}":
            if stack:
                stack.pop()
                if not stack:
                    return text[start:i+1]
    return None

def safe_date(val):
    try:
        return parser.parse(val, fuzzy=True).strftime("%d/%m/%Y")
    except:
        return None

def normalize_amount(val):
    if not val:
        return None
    match = re.search(r"[\d,.]+", str(val))
    if not match:
        return None
    cleaned = match.group(0).replace(",", "")
    try:
        return float(cleaned)
    except:
        return None

def detect_document_type(text):
    lower = text.lower()
    if "notice" in lower and "settlement" in lower:
        return "NOTICE AND SETTLEMENT"
    if "notice" in lower:
        return "NOTICE"
    if "settlement" in lower:
        return "SETTLEMENT"
    if "judgment" in lower:
        return "JUDGMENT"
    if "mortgage" in lower:
        return "MORTGAGE"
    if "deed" in lower:
        return "DEED"
    return "OTHER"

# ---------------- Core PDF Processing ----------------
def process_pdf(pdf_path, filename):

    poppler_path = os.getenv("POPPLER_PATH")
    try:
        if poppler_path:
            print(f"Using custom Poppler path: {poppler_path}")
            pages = convert_from_path(pdf_path, dpi=200, poppler_path=poppler_path)
        else:
            print("Using system default Poppler path")
            pages = convert_from_path(pdf_path, dpi=200)
    except Exception as e:
        print(f"Error converting PDF {filename}: {e}")
        return None

    all_text = ""
    # Process all pages to ensure full legal description is captured
    for i, page in enumerate(pages):
        page_text = printed_ocr(page)
        # Run TrOCR only if printed OCR yields very little text
        if len(page_text.strip()) < 50:
            page_text += "\n" + handwritten_ocr(page)
        all_text += page_text + "\n"

    doc_type = detect_document_type(all_text)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable is not set.")
        return None
        
    client = OpenAI(api_key=api_key)

    prompt = f"""
Return ONLY valid JSON.

{{
 "DOCUMENT_TYPE": "{doc_type}",
 "GRANTOR": "",
 "GRANTEE": "",
 "INSTRUMENT_NUMBER": "",
 "RECORDING_DATE": "",
 "DATED_DATE": "",
 "CONSIDERATION_AMOUNT": "",
 "BOOK": "",
 "PAGENO": "",
 "LEGAL_DESCRIPTION": ""
}}

TEXT:
{all_text}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.choices[0].message.content
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return None

    clean = extract_json(raw)
    if not clean:
        return None

    try:
        data = json.loads(clean)
    except:
        return None

    data.update(regex_extract(all_text))

    for k in ["RECORDING_DATE","DATED_DATE"]:
        if data.get(k):
            data[k] = safe_date(data[k])

    if data.get("CONSIDERATION_AMOUNT"):
        data["CONSIDERATION_AMOUNT"] = normalize_amount(data["CONSIDERATION_AMOUNT"])

    if data.get("LEGAL_DESCRIPTION"):
        data["LEGAL_DESCRIPTION"] = data["LEGAL_DESCRIPTION"].replace("\n"," ").upper()

    data["SOURCE_FILE"] = filename

    return data


# ---------------- ROUTE ----------------
@details_bp.route("/extract_by_file_number", methods=["POST"])
def extract_by_file_number():

    data = request.get_json()

    if not data or "file_number" not in data:
        return jsonify({"error": "file_number is required"}), 400

    file_number = str(data["file_number"]).strip()

    target_folder = None
    
    direct_folder = APP_ROOT / file_number
    if direct_folder.exists() and direct_folder.is_dir():
        target_folder = direct_folder.resolve()
    else:
        for item in APP_ROOT.iterdir():
            if item.is_dir() and item.name not in ["blueprints", "services", "utils", "__pycache__", "pages", "uploads", "venv"]:
                potential_folder = item / file_number
                if potential_folder.exists() and potential_folder.is_dir():
                    target_folder = potential_folder.resolve()
                    break

    if not target_folder:
        return jsonify({"error": f"Folder for file number {file_number} not found"}), 404

    if not str(target_folder).startswith(str(APP_ROOT)):
        return jsonify({"error": "Invalid folder path"}), 400

    all_results = []
    processed_files = set()

    for root, dirs, files in os.walk(target_folder):
        for file in files:

            if not file.lower().endswith(".pdf"):
                continue

            if any(word in file.lower() for word in ["index", "lot", "block"]):
                continue

            if file in processed_files:
                continue
            processed_files.add(file)

            pdf_path = os.path.join(root, file)


            try:
                result = process_pdf(pdf_path, file)
                if result:
                    result["FOLDER_NAME"] = file_number
                    all_results.append(result)
            except Exception as e:
                print(f"Error processing {file}: {e}")

    if not all_results:
        return jsonify({"message": "No valid PDFs found"}), 200

    output_csv = os.path.join(UPLOAD_FOLDER, f"{file_number}_output.csv")
    pd.DataFrame(all_results).to_csv(output_csv, index=False)

    return jsonify({
        "file_number": file_number,
        "total_files_processed": len(all_results),
        "data": all_results
    })