import os
import time 
import io
import pymupdf as fitz
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from PIL import Image

load_dotenv()

app = FastAPI(title="Paperwise API")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini Client
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("WARNING: GEMINI_API_KEY is not set in backend/.env")

client = genai.Client(api_key=api_key)

# Optional local Tesseract check
HAS_TESSERACT = False
try:
    import pytesseract
    pytesseract.get_tesseract_version()
    HAS_TESSERACT = True
except Exception:
    HAS_TESSERACT = False


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extracts text from PDF bytes.
    If a page has fewer than 40 characters, converts it to an image
    and runs OCR via Tesseract (if available) or Gemini Vision.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        extracted = page.get_text().strip()

        # If digital text exists, keep it
        if len(extracted) > 40:
            pages_text.append(f"--- Page {page_idx + 1} ---\n{extracted}")
            continue

        # Scanned page fallback: render page to image
        pix = page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes("png")))

        ocr_result = ""
        if HAS_TESSERACT:
            try:
                ocr_result = pytesseract.image_to_string(img).strip()
            except Exception:
                ocr_result = ""

        # Fallback to Gemini Vision if Tesseract fails or isn't installed
        if not ocr_result:
            try:
                response = client.models.generate_content(
                    model="gemini-3.8-flash",
                    contents=[
                        img,
                        "Extract all legible text, exam questions, or notes from this image. Return only the extracted text without extra conversational commentary.",
                    ],
                )
                ocr_result = response.text.strip() if response.text else ""
            except Exception as e:
                ocr_result = f"[OCR error on page {page_idx + 1}: {str(e)}]"

        pages_text.append(f"--- Page {page_idx + 1} (OCR) ---\n{ocr_result}")

    return "\n\n".join(pages_text)


class QuestionRequest(BaseModel):
    notes_text: str
    past_papers_text: str = ""


@app.get("/")
def home():
    return {"status": "Paperwise Backend is Running"}


@app.post("/api/extract-text")
async def extract_text(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    try:
        text = extract_text_from_pdf(content)
        return {"filename": file.filename, "extracted_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")


@app.post("/api/generate-questions")
async def generate_questions(payload: QuestionRequest):
    if not payload.notes_text.strip():
        raise HTTPException(status_code=400, detail="Notes text cannot be empty.")

    prompt = f"""
    You are an expert university professor and exam paper setter. Analyze the syllabus/notes and past exam papers to formulate a high-yield exam question set.

    ### SYLLABUS / STUDENT NOTES:
    {payload.notes_text[:12000]}

    ### PAST EXAM PAPERS:
    {payload.past_papers_text[:12000] if payload.past_papers_text else "None provided. Extrapolate from syllabus topics directly."}

    ### TASK:
    Create a realistic prediction exam paper formatted in clean Markdown:
    1. **High-Probability Long Questions**: The most recurring and critical theoretical and derivation questions.
    2. **Applied & Numerical / Scenario-Based Questions**: Problems that test practical understanding.
    3. **Rapid Revision / Short Concept Questions**: Quick 2-mark definitions and distinctions.
    4. For every question, include a concise 1-2 line **"Examiner's Hint / Key Formula"**.
    """

    # Retry up to 3 times on the active model if Google's servers return 503 high-demand
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
            )
            if response.text:
                return {"questions": response.text}
        except Exception as e:
            if "503" in str(e) and attempt < 2:
                time.sleep(2)  # Wait 2 seconds and retry automatically
                continue
            raise HTTPException(status_code=500, detail=f"Gemini generation error: {str(e)}")