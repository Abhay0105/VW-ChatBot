"""
Document parsing helpers for supported knowledge base uploads.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

SUPPORTED_UPLOAD_TYPES = (".txt", ".md", ".csv", ".pdf", ".docx")
TEXT_UPLOAD_TYPES = {".txt", ".md", ".csv"}
WORDPROCESSINGML_NAMESPACE = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


class DocumentParsingError(ValueError):
    """Raised when an uploaded document cannot be parsed."""


class UnsupportedDocumentTypeError(DocumentParsingError):
    """Raised when the upload type is not supported."""


class MissingDependencyError(DocumentParsingError):
    """Raised when optional parser dependencies are unavailable."""


def supported_upload_types_label() -> str:
    """Return the supported upload types for user-facing messages."""
    return ", ".join(SUPPORTED_UPLOAD_TYPES)


def extract_text_from_upload(
    content: bytes, filename: str, content_type: str | None = None
) -> tuple[str, dict[str, Any]]:
    """Extract plain text content from a supported upload."""
    extension = get_upload_extension(filename)

    if extension in TEXT_UPLOAD_TYPES:
        text = decode_text_upload(content)
        metadata: dict[str, Any] = {"parser": "text-decoder"}
    elif extension == ".pdf":
        text, metadata = extract_pdf_text(content)
    elif extension == ".docx":
        text, metadata = extract_docx_text(content)
    else:
        raise UnsupportedDocumentTypeError(
            f"Unsupported file type '{extension}'. Supported file types: {supported_upload_types_label()}."
        )

    normalized_text = normalize_extracted_text(text)
    if not normalized_text.strip():
        raise DocumentParsingError("The uploaded document does not contain any extractable text.")

    metadata.update(
        {
            "file_type": extension.lstrip("."),
            "filename": filename,
        }
    )
    if content_type:
        metadata["content_type"] = content_type

    return normalized_text, metadata


def get_upload_extension(filename: str) -> str:
    """Return a normalized extension for a supported upload."""
    extension = Path(filename or "").suffix.lower()
    if extension not in SUPPORTED_UPLOAD_TYPES:
        raise UnsupportedDocumentTypeError(
            f"Unsupported file type '{extension or 'unknown'}'. Supported file types: {supported_upload_types_label()}."
        )
    return extension


def decode_text_upload(content: bytes) -> str:
    """Decode plain-text uploads using common UTF encodings."""
    for encoding in ("utf-8-sig", "utf-8", "utf-16"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise DocumentParsingError(
        "Could not decode the uploaded file. Please use UTF-8 or UTF-16 encoded text."
    )


def extract_pdf_text(content: bytes) -> tuple[str, dict[str, Any]]:
    """Extract text from a PDF document using pypdf."""
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise MissingDependencyError(
            "PDF support is not installed on the backend. Install the 'pypdf' package to enable PDF uploads."
        ) from exc

    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception as exc:  # pragma: no cover - third-party parser errors vary
        raise DocumentParsingError("The PDF file is invalid or could not be opened.") from exc

    page_text: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            extracted_text = page.extract_text() or ""
        except Exception as exc:  # pragma: no cover - third-party parser errors vary
            raise DocumentParsingError(
                f"Could not read text from page {index} of the PDF."
            ) from exc

        cleaned_text = normalize_extracted_text(extracted_text)
        if cleaned_text:
            page_text.append(f"Page {index}\n{cleaned_text}")

    return "\n\n".join(page_text), {"parser": "pypdf", "page_count": len(reader.pages)}


def extract_docx_text(content: bytes) -> tuple[str, dict[str, Any]]:
    """Extract text from a DOCX file without external dependencies."""
    try:
        with ZipFile(io.BytesIO(content)) as archive:
            document_xml = archive.read("word/document.xml")
    except BadZipFile as exc:
        raise DocumentParsingError("The DOCX file is invalid or corrupted.") from exc
    except KeyError as exc:
        raise DocumentParsingError("The DOCX file does not contain readable document content.") from exc

    try:
        root = ET.fromstring(document_xml)
    except ET.ParseError as exc:
        raise DocumentParsingError("Could not parse the DOCX document content.") from exc

    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", WORDPROCESSINGML_NAMESPACE):
        parts: list[str] = []
        for node in paragraph.iter():
            tag = local_name(node.tag)
            if tag == "t" and node.text:
                parts.append(node.text)
            elif tag == "tab":
                parts.append("\t")
            elif tag in {"br", "cr"}:
                parts.append("\n")

        paragraph_text = normalize_extracted_text("".join(parts))
        if paragraph_text:
            paragraphs.append(paragraph_text)

    return "\n\n".join(paragraphs), {"parser": "docx-xml", "paragraph_count": len(paragraphs)}


def normalize_extracted_text(text: str) -> str:
    """Normalize line endings and remove empty trailing whitespace."""
    normalized_lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    normalized_text = "\n".join(normalized_lines)
    return normalized_text.strip()


def local_name(tag: str) -> str:
    """Return the XML local name for a namespaced tag."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag
