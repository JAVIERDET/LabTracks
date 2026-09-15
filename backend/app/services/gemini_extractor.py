import base64
import logging
from typing import Optional
from google import genai

from app.core.config import settings
from app.schemas.lab import LabExtractionResult
from app.services.local_parser import local_lab_parser
from app.services.storage import storage_service

logger = logging.getLogger("labtrack.gemini_extractor")


class GeminiLabExtractor:
    """Extracts structured lab test data from documents and images using Gemini API,

    with fallback to local heuristic parsing when API key is unconfigured.
    """

    SYSTEM_PROMPT = """
You are an expert clinical laboratory documentation assistant.
Extract all biomarker test data accurately from this medical laboratory document or image.

Requirements:
1. Test Date:
   - Identify the date the specimen was collected or reported.
   - Format as YYYY-MM-DD.
   - If no specimen/test date is identifiable in the document, set test_date to null and requires_manual_date to true.
2. Biomarkers:
   - Extract EVERY biomarker/analyte present (e.g., Triglycerides, HDL Cholesterol, LDL Cholesterol, Glucose, Total Cholesterol, Creatinine, Hemoglobin, etc.).
   - name: Standardized clean name (e.g. "Triglycerides", "HDL Cholesterol", "Glucose").
   - raw_name: Exact label as printed on the document.
   - value: Numeric result as a floating point number. If a prefix like "<" or ">" is present, extract the numeric value and note the boundary.
   - unit: Unit of measurement (e.g., mg/dL, mmol/L, g/dL, µmol/L, etc.).
   - ref_min: Numeric lower bound of reference interval, or null if open-ended.
   - ref_max: Numeric upper bound of reference interval, or null if open-ended.
   - reference_range_raw: Original raw reference string from report (e.g., "< 150", "70 - 99", "3.9 - 5.6").
   - flag: 'H' if high/abnormal, 'L' if low/abnormal, 'Normal' if within limits, or null.
   - category: Laboratory panel name if identified (e.g. 'Lipid Panel', 'Comprehensive Metabolic Panel', 'Complete Blood Count').
3. Confidence:
   - Provide a realistic confidence_score between 0.0 and 1.0.
"""

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL or "gemini-3.8-flash"

    def has_api_key(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def extract_from_file(
        self, file_bytes: bytes, filename: str, mime_type: Optional[str] = None
    ) -> LabExtractionResult:
        """Extract lab results using Gemini API if key is available, else local parser."""
        if not self.has_api_key():
            logger.info("GEMINI_API_KEY not configured. Using local parser fallback.")
            return local_lab_parser.parse_document(file_bytes, filename)

        if not mime_type:
            mime_type = storage_service.guess_mime_type(filename, file_bytes)

        b64_data = base64.b64encode(file_bytes).decode("utf-8")

        # Determine input payload based on mime_type
        if mime_type == "application/pdf":
            input_content = [
                {"type": "text", "text": self.SYSTEM_PROMPT},
                {
                    "type": "document",
                    "data": b64_data,
                    "mime_type": "application/pdf",
                },
            ]
        else:
            # Image (jpeg, png, webp, etc.)
            input_content = [
                {"type": "text", "text": self.SYSTEM_PROMPT},
                {
                    "type": "image",
                    "data": b64_data,
                    "mime_type": mime_type if mime_type.startswith("image/") else "image/jpeg",
                },
            ]

        try:
            client = genai.Client(api_key=self.api_key)
            logger.info(f"Calling Gemini API ({self.model_name}) for file {filename}...")

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
                raise ValueError("Empty response received from Gemini API")

            result = LabExtractionResult.model_validate_json(raw_json)
            # Ensure requires_manual_date is True if test_date is missing
            if result.test_date is None:
                result.requires_manual_date = True

            logger.info(
                f"Successfully extracted {len(result.biomarkers)} biomarkers from {filename} via Gemini API"
            )
            return result

        except Exception as e:
            logger.error(f"Gemini API extraction error: {e}. Falling back to local parser.", exc_info=True)
            fallback_result = local_lab_parser.parse_document(file_bytes, filename)
            fallback_result.notes = f"Parsed with local fallback (Gemini error: {str(e)})"
            return fallback_result


gemini_extractor = GeminiLabExtractor()

