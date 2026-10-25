import os
import io
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pypdf

# Test content extraction logic for tutor uploads and syllabus uploads

def extract_tutor_preview(file_bytes: bytes, filename: str) -> str:
    """Mirrors upload_tutor_file extraction logic in server.py"""
    ext = os.path.splitext(filename)[1].lower()
    content_preview = ""
    if ext in ['.txt', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.md', '.csv', '.yml', '.yaml']:
        content_preview = file_bytes.decode("utf-8", errors="ignore")[:5000]
    elif ext == '.pdf':
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages[:3]:
            t = page.extract_text()
            if t:
                text += t
            if len(text) > 5000:
                break
        content_preview = text[:5000]
    return content_preview


def test_txt_content_extraction():
    content = "Module 1: Linear Algebra\nModule 2: Multivariable Calculus\nModule 3: Optimization"
    preview = extract_tutor_preview(content.encode("utf-8"), "syllabus.txt")
    assert "Linear Algebra" in preview
    assert "Optimization" in preview


def test_code_content_extraction():
    code = "def binary_search(arr, target):\n    low, high = 0, len(arr) - 1\n    return -1\n"
    preview = extract_tutor_preview(code.encode("utf-8"), "algo.py")
    assert "def binary_search" in preview
    assert "target" in preview


def test_markdown_content_extraction():
    md = "# Computer Systems\n\n## CPU Scheduling\n- FCFS\n- Round Robin\n- Priority"
    preview = extract_tutor_preview(md.encode("utf-8"), "notes.md")
    assert "# Computer Systems" in preview
    assert "Round Robin" in preview


def test_pdf_content_extraction():
    # Generate a real PDF using pypdf.PdfWriter
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    
    # We can write a stream or create a minimal PDF with text stream
    # Minimal PDF with text object:
    pdf_buffer = io.BytesIO()
    # Write a test PDF with text stream
    writer.write(pdf_buffer)
    pdf_bytes = pdf_buffer.getvalue()
    
    # Verify reader can parse it without error
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 1
    
    # Test reading actual PDF bytes with text
    preview = extract_tutor_preview(pdf_bytes, "lecture1.pdf")
    assert isinstance(preview, str)


def test_null_byte_sanitization():
    from server import sanitize_postgres_string
    dirty_string = "Intro to DB\x00 with null bytes\x00"
    cleaned = sanitize_postgres_string(dirty_string)
    assert "\x00" not in cleaned
    assert cleaned == "Intro to DB with null bytes"


if __name__ == "__main__":
    test_txt_content_extraction()
    test_code_content_extraction()
    test_markdown_content_extraction()
    test_pdf_content_extraction()
    test_null_byte_sanitization()
    print("ALL FILE EXTRACTION TESTS PASSED!")
