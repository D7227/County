from flask import Blueprint, request, jsonify
from pdf2image import convert_from_path
import os
import tempfile
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

# ---------------- Blueprint Definition ----------------
details_bp = Blueprint('details_bp', __name__)

APP_ROOT = pathlib.Path(__file__).parent.parent.resolve()
UPLOAD_FOLDER = str(APP_ROOT / "uploads")
# os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Removed as requested

# ---------------- OpenAI Client ----------------
client = OpenAI()  # Use environment variable

# ---------------- Token Counter ----------------
token_usage = {
    "total_input_tokens": 0,
    "total_output_tokens": 0,
    "total_tokens": 0,
    "api_calls": 0
}

# ---------------- Load TrOCR (keep global) ----------------
processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
model.eval()

# ---------------- OCR Functions ----------------
def printed_ocr_from_array(img_array):
    if len(img_array.shape) == 3:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_array
    gray = cv2.resize(gray, None, fx=1.3, fy=1.3, interpolation=cv2.INTER_CUBIC)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Optimized for structured headers (PSM 3)
    return pytesseract.image_to_string(thresh, config='--oem 3 --psm 3')

def handwritten_ocr_from_array(img_array):
    image = Image.fromarray(img_array).convert("RGB")
    pixel_values = processor(image, return_tensors="pt").pixel_values
    with torch.no_grad():
        generated_ids = model.generate(pixel_values)
    return processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

# ---------------- Helper Functions ----------------
def regex_extract(text):
    result = {}
    
    # Expanded Instrument Number Patterns
    instrument_patterns = [
        r"\bInstrument\s+(?:Number|No\.?|#)\s*[:#-]?\s*([A-Z0-9-]{4,})",
        r"\bDocument\s+(?:Number|No\.?|#)\s*[:#-]?\s*([A-Z0-9-]{4,})",
        r"\bDoc\s+(?:Number|No\.?|#)\s*[:#-]?\s*([A-Z0-9-]{4,})",
        r"\bInst\.?\s*#?\s*([A-Z0-9-]{4,})",
        r"\bDoc\.?\s*No\.?\s*([A-Z0-9-]{4,})",
        r"\bRecording\s+Number\s*[:#-]?\s*([A-Z0-9-]{4,})",
    ]
    for pattern in instrument_patterns:
        m = re.search(pattern, text, re.I)
        if m:
            candidate = m.group(1).strip()
            if re.search(r"\d", candidate):
                result["INSTRUMENT_NUMBER"] = candidate
            break
    
    # Consideration Amount
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
    
    # Recording Date
    m = re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", text, re.I)
    if m:
        result["RECORDING_DATE"] = m.group()
    
    # Book and Page together
    book_page_pattern = r"\bBook\s*[:#]?\s*(\d+)\s*[,\s]*Page\s*[:#]?\s*(\d+)"
    m = re.search(book_page_pattern, text, re.I)
    if m:
        result["BOOK"] = m.group(1)
        result["PAGENO"] = m.group(2)
    else:
        # Try Book alone
        m = re.search(r"\bBook\s*[:#]?\s*(\d+)", text, re.I)
        if m:
            result["BOOK"] = m.group(1)
            book_pos = m.end()
            page_search = text[book_pos:book_pos+50]
            page_match = re.search(r"Page\s*[:#]?\s*(\d+)", page_search, re.I)
            if page_match:
                result["PAGENO"] = page_match.group(1)

    return result

def extract_json(text):
    stack = []
    start = None
    for i, c in enumerate(text):
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

# ---------------- Core Processing ----------------
def process_pdf(pdf_path, filename):

    all_text = ""

    # Process all pages to get complete legal description
    with tempfile.TemporaryDirectory() as tmpdir:
        pages = convert_from_path(pdf_path, dpi=200, output_folder=tmpdir, paths_only=False)

        for page in pages:
            img_array = np.array(page)
            text = printed_ocr_from_array(img_array)
            if len(text.strip()) < 50:
                text += handwritten_ocr_from_array(img_array)
            all_text += text
            page.close()

    doc_type = detect_document_type(all_text)

    # Refined Prompt for better Grantor/Grantee identification
    prompt = f"""
Return ONLY valid JSON. 

Identify legal parties strictly. GRANTOR is often 'Party 1', 'From', 'Mortgagor', 'Lienor', or 'Assignor'. 
GRANTEE is often 'Party 2', 'To', 'Mortgagee', 'Lienee', or 'Assignee'.
Prioritize accuracy and full legal names. Do not summarize names.

Extract the COMPLETE legal description exactly as it appears.

{{
 "DOCUMENT_TYPE": "{doc_type}",
 "GRANTOR": "Full name of the first party/grantor",
 "GRANTEE": "Full name of the second party/grantee",
 "INSTRUMENT_NUMBER": "",
 "RECORDING_DATE": "",
 "CONSIDERATION_AMOUNT": "",
 "BOOK": "",
 "PAGENO": "",
 "LEGAL_DESCRIPTION": ""
}}

TEXT:
{all_text[:8000]}
"""

    try:
        # Standardize on gpt-4o-mini for better reliability
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.choices[0].message.content
        
    except Exception as e:
        print(f"Extraction error: {e}")
        return None

    clean = extract_json(raw)
    if not clean:
        return None

    data = json.loads(clean)
    
    # Post-process with Regex
    regex_data = regex_extract(all_text)
    for key, value in regex_data.items():
        if not data.get(key) or data.get(key) == "":
            data[key] = value
            
    # Instrument Number Fallback: Check filename
    if not data.get("INSTRUMENT_NUMBER") or data.get("INSTRUMENT_NUMBER") == "":
        # Look for a 10-digit number like 2026001821 in filename
        fn_match = re.search(r"(\d{4,12})", filename)
        if fn_match:
            data["INSTRUMENT_NUMBER"] = fn_match.group(1)
    
    if data.get("LEGAL_DESCRIPTION"):
        data["LEGAL_DESCRIPTION"] = " ".join(data["LEGAL_DESCRIPTION"].split())
    
    data["SOURCE_FILE"] = filename

    return data

# ---------------- Process Folder Route ----------------
@details_bp.route("/extract_by_file_number", methods=["POST"])
def extract_by_file_number():
    """Process PDFs by file number using existing path logic"""
    
    data = request.get_json()
    
    if not data or "file_number" not in data:
        return jsonify({
            "error": "file_number is required",
            "example": '{"file_number": "628241"}'
        }), 400
    
    file_number = str(data["file_number"]).strip()
    
    # Reset token counter for this request
    global token_usage
    token_usage = {
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_tokens": 0,
        "api_calls": 0
    }
    
    # --- Existing lookup logic preserved as requested ---
    target_folder = None
    direct_folder = APP_ROOT / file_number
    if direct_folder.exists() and direct_folder.is_dir():
        target_folder = direct_folder
    else:
        # Try looking in subfolders (e.g., bergen/file_number)
        for item in APP_ROOT.iterdir():
            if item.is_dir() and item.name not in ["blueprints", "services", "utils", "__pycache__", "pages", "uploads", "venv"]:
                potential_folder = item / file_number
                if potential_folder.exists() and potential_folder.is_dir():
                    target_folder = potential_folder
                    break
    
    if not target_folder:
        return jsonify({
            "error": f"Folder for file number {file_number} not found",
            "message": f"Could not locate folder for {file_number} in project root or subfolders"
        }), 404
        
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
                    result["FOLDER_NUMBER"] = file_number
                    all_results.append(result)
            except Exception as e:
                print(f"Error processing {file}: {e}")
    
    if not all_results:
        return jsonify({
            "message": "No valid PDFs found in folder",
            "file_number": file_number
        }), 200
        
    return jsonify({
        "file_number": file_number,
        "total_files_processed": len(all_results),
        "token_usage": {
            "total_input_tokens": token_usage["total_input_tokens"],
            "total_output_tokens": token_usage["total_output_tokens"],
            "total_tokens": token_usage["total_tokens"],
            "api_calls_made": token_usage["api_calls"]
        },
        "data": all_results
    })