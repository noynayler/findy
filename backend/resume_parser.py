"""Resume PDF text extraction."""

import io
import re
from typing import Optional, Tuple

import pdfplumber


_pytesseract = None
_convert_from_bytes = None


def _get_ocr():
    global _pytesseract, _convert_from_bytes
    if _pytesseract is None:
        try:
            import pytesseract
            from pdf2image import convert_from_bytes
            _pytesseract = pytesseract
            _convert_from_bytes = convert_from_bytes
        except ImportError:
            pass
    return _pytesseract, _convert_from_bytes


def extract_text_from_pdf(pdf_bytes: bytes, enable_ocr: bool = False, tesseract_cmd: Optional[str] = None) -> Tuple[str, bool]:
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text_parts = [p.extract_text() for p in pdf.pages if p.extract_text()]
            if text_parts:
                text = re.sub(r"\s+", " ", "\n".join(text_parts).strip())
                text = re.sub(r"[^\w\s\n\-\.,;:!?()]", " ", text).strip()
                if len(text) > 100:
                    return text, False
    except Exception as e:
        print(f"pdfplumber extraction failed: {e}")
    if enable_ocr:
        pytesseract, convert_from_bytes = _get_ocr()
        if pytesseract and convert_from_bytes:
            try:
                if tesseract_cmd:
                    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
                images = convert_from_bytes(pdf_bytes)
                text = "\n".join(pytesseract.image_to_string(img, lang="eng") for img in images).strip()
                return re.sub(r"\s+", " ", text).strip(), True
            except Exception as e:
                print(f"OCR extraction failed: {e}")
    return "", False
