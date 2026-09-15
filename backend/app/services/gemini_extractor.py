import base64
import logging
from typing import Any

from google import genai

from app.core.config import settings
from app.schemas.lab import LabExtractionResult
from app.services.local_parser import local_lab_parser
from app.services.storage import storage_service

logger = logging.getLogger("labtrack.gemini_extractor")


class GeminiLabExtractor:
    """Extracts lab test data via Gemini API with local fallback."""

    SYSTEM_PROMPT = """
You are an expert clinical laboratory documentation assistant.
Extract all biomarker test data accurately from this document or image.

Requirements:
1. Test Date:
   - Identify specimen collection or report date (YYYY-MM-DD).
   - If missing, set test_date to null and requires_manual_date to true.
2. Biomarkers:
   - Extract every biomarker (Triglycerides, HDL, LDL, Glucose, etc.).
   - name: Standardized clean name.
   - raw_name: Exact label as printed.
   - value: Numeric result as float.
   - unit: Unit of measurement (e.g. mg/dL, mmol/L, g/dL, µmol/L).
   - ref_min: Lower bound or null.
   - ref_max: Upper bound or null.
   - reference_range_raw: Original range string.
   - flag: 'H', 'L', 'Normal', or null.
   - category: Laboratory panel name if identified.
3. Confidence:
   - Provide confidence_score between 0.0 and 1.0.
"""

    def __init__(self) -> None:
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL or "gemini-3.8-flash"

    def has_api_key(self) -> bool:
        """Check if GEMINI_API_KEY is configured."""
        return bool(self.api_key and self.api_key.strip())

    @staticmethod
    def _fail_empty_response() -> None:
        msg = "Empty response received from Gemini API"
        raise ValueError(msg)

    def _build_input_payload(
        self, file_bytes: bytes, mime_type: str
    ) -> list[dict[str, Any]]:
        """Construct multimodal content payload for Gemini interactions."""
        # Strip prepended headers for PDFs
        clean_bytes = (
            local_lab_parser.sanitize_pdf_bytes(file_bytes)
            if mime_type == "application/pdf"
            else file_bytes
        )
        b64_data = base64.b64encode(clean_bytes).decode("utf-8")

        if mime_type == "application/pdf":
            return [
                {"type": "text", "text": self.SYSTEM_PROMPT},
                {
                    "type": "document",
                    "data": b64_data,
                    "mime_type": "application/pdf",
                },
            ]

        img_mime = (
            mime_type if mime_type.startswith("image/") else "image/jpeg"
        )
        return [
            {"type": "text", "text": self.SYSTEM_PROMPT},
            {"type": "image", "data": b64_data, "mime_type": img_mime},
        ]

    async def extract_from_file(
        self, file_bytes: bytes, filename: str, mime_type: str | None = None
    ) -> LabExtractionResult:
        """Extract lab results using Gemini API if key is set, else local."""
        if not self.has_api_key():
            logger.info("GEMINI_API_KEY not set. Using local parser fallback.")
            return local_lab_parser.parse_document(file_bytes, filename)

        resolved_mime = mime_type or storage_service.guess_mime_type(
            filename, file_bytes
        )
        input_content = self._build_input_payload(file_bytes, resolved_mime)

        try:
            client = genai.Client(api_key=self.api_key)
            logger.info(
                "Calling Gemini (%s) for %s...", self.model_name, filename
            )

            interaction = client.interactions.create(
                model=self.model_name,
                input=input_content,
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": LabExtractionResult.model_json_schema(),
                },
            )

            raw_json = interaction.output_text
            if not raw_json:
                self._fail_empty_response()

            result = LabExtractionResult.model_validate_json(raw_json)
            if result.test_date is None:
                result.requires_manual_date = True
        except (ValueError, OSError, RuntimeError) as e:
            logger.exception("Gemini API error. Falling back to local parser.")
            fallback_result = local_lab_parser.parse_document(
                file_bytes, filename
            )
            fallback_result.notes = f"Local fallback (Gemini error: {e!s})"
            return fallback_result
        else:
            logger.info(
                "Extracted %d biomarkers from %s via Gemini API",
                len(result.biomarkers),
                filename,
            )
            return result


gemini_extractor = GeminiLabExtractor()
