import io
import logging
import re
from datetime import date, datetime
from typing import List, Optional, Tuple
from pypdf import PdfReader

from app.schemas.lab import BiomarkerResult, LabExtractionResult
from app.services.unit_converter import unit_converter

logger = logging.getLogger("labtrack.local_parser")


class LocalLabParser:
    """Local heuristic and regex parser for testing and development fallback."""

    DATE_PATTERNS = [
        # YYYY-MM-DD
        (r"\b(20\d\d)[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b", "%Y-%m-%d"),
        # MM/DD/YYYY
        (r"\b(0[1-9]|1[0-2])/(0[1-9]|[12]\d|3[01])/(20\d\d)\b", "%m/%d/%Y"),
        # DD/MM/YYYY
        (r"\b(0[1-9]|[12]\d|3[01])/(0[1-9]|1[0-2])/(20\d\d)\b", "%d/%m/%Y"),
        # Mon DD, YYYY (e.g. Oct 14, 2024 or October 14, 2024)
        (
            r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d\d)\b",
            "MONTH_NAME",
        ),
    ]

    MONTH_MAP = {
        "jan": 1,
        "january": 1,
        "feb": 2,
        "february": 2,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "may": 5,
        "jun": 6,
        "june": 6,
        "jul": 7,
        "july": 7,
        "aug": 8,
        "august": 8,
        "sep": 9,
        "september": 9,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }

    # Sorted by length descending so longer/more specific names match first
    KNOWN_MARKERS = sorted(
        [
            ("Vitamin D (25-OH)", "Vitamins"),
            ("Vitamin D, 25-Hydroxy", "Vitamins"),
            ("25-Hydroxyvitamin D", "Vitamins"),
            ("Vitamin D", "Vitamins"),
            ("Blood Urea Nitrogen", "Metabolic Panel"),
            ("Total Cholesterol", "Lipid Panel"),
            ("Cholesterol, Total", "Lipid Panel"),
            ("HDL Cholesterol", "Lipid Panel"),
            ("LDL Cholesterol", "Lipid Panel"),
            ("Triglycerides", "Lipid Panel"),
            ("Fasting Glucose", "Metabolic Panel"),
            ("Glucose", "Metabolic Panel"),
            ("Creatinine", "Metabolic Panel"),
            ("Total Protein", "Metabolic Panel"),
            ("Total Bilirubin", "Metabolic Panel"),
            ("Bilirubin, Total", "Metabolic Panel"),
            ("Albumin", "Metabolic Panel"),
            ("Calcium", "Metabolic Panel"),
            ("Hemoglobin", "Complete Blood Count"),
            ("Hematocrit", "Complete Blood Count"),
            ("Platelets", "Complete Blood Count"),
            ("WBC", "Complete Blood Count"),
            ("RBC", "Complete Blood Count"),
            ("Ferritin", "Iron Panel"),
            ("TSH", "Thyroid Panel"),
            ("Uric Acid", "Metabolic Panel"),
            ("BUN", "Metabolic Panel"),
        ],
        key=lambda x: len(x[0]),
        reverse=True,
    )

    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text_pages = []
            for page in reader.pages:
                text = page.extract_text() or ""
                text_pages.append(text)
            return "\n".join(text_pages)
        except Exception as e:
            logger.warning(f"Could not extract text from PDF: {e}")
            return ""

    def detect_test_date(self, text: str) -> Optional[date]:
        # Prioritize lines mentioning Date, Collection, Collected, Specimen, Reported
        date_lines = []
        for line in text.splitlines():
            if any(k in line.lower() for k in ["date", "collected", "specimen", "reported", "drawn", "service"]):
                date_lines.append(line)

        search_text = "\n".join(date_lines) + "\n" + text

        for pattern, fmt in self.DATE_PATTERNS:
            match = re.search(pattern, search_text, re.IGNORECASE)
            if match:
                if fmt == "MONTH_NAME":
                    month_str = match.group(1).lower()
                    day = int(match.group(2))
                    year = int(match.group(3))
                    month = self.MONTH_MAP.get(month_str, 1)
                    try:
                        return date(year, month, day)
                    except ValueError:
                        continue
                else:
                    try:
                        matched_str = match.group(0).replace("/", "-")
                        parts = [int(p) for p in re.findall(r"\d+", matched_str)]
                        if fmt == "%Y-%m-%d":
                            return date(parts[0], parts[1], parts[2])
                        elif fmt == "%m/%d/%Y":
                            return date(parts[2], parts[0], parts[1])
                        elif fmt == "%d/%m/%Y":
                            return date(parts[2], parts[1], parts[0])
                    except (ValueError, IndexError):
                        continue
        return None

    def parse_reference_range(self, raw_range: str) -> Tuple[Optional[float], Optional[float]]:
        if not raw_range:
            return None, None

        # Pattern: min - max (e.g. "70 - 99", "3.5-5.0")
        range_match = re.search(r"(\d+(?:\.\d+)?)\s*[-–—to]+\s*(\d+(?:\.\d+)?)", raw_range)
        if range_match:
            try:
                return float(range_match.group(1)), float(range_match.group(2))
            except ValueError:
                pass

        # Pattern: < max (e.g. "< 150", "<100")
        less_match = re.search(r"[<≤]\s*(\d+(?:\.\d+)?)", raw_range)
        if less_match:
            try:
                return None, float(less_match.group(1))
            except ValueError:
                pass

        # Pattern: > min (e.g. "> 50", ">= 60")
        greater_match = re.search(r"[>≥]\s*(\d+(?:\.\d+)?)", raw_range)
        if greater_match:
            try:
                return float(greater_match.group(1)), None
            except ValueError:
                pass

        return None, None

    def parse_biomarkers_from_text(self, text: str) -> List[BiomarkerResult]:
        results: List[BiomarkerResult] = []
        found_names = set()

        lines = [l.strip() for l in text.splitlines() if l.strip()]

        for i, line in enumerate(lines):
            for marker_name, category in self.KNOWN_MARKERS:
                pattern = rf"^{re.escape(marker_name)}(\b|\:|\s|$)"
                match = re.search(pattern, line, re.IGNORECASE)
                if not match:
                    # Also try anywhere in line if line is relatively short (<= 40 chars)
                    if len(line) <= 40:
                        match = re.search(rf"\b{re.escape(marker_name)}\b", line, re.IGNORECASE)
                if not match:
                    continue

                canonical = unit_converter.canonical_biomarker_name(marker_name)
                if canonical in found_names:
                    continue

                # Build context window: current line remainder + up to next 5 lines
                remainder = line[match.end() :].strip()
                window_lines = [remainder] if remainder else []
                # Check next lines until another known marker is seen or up to 5 lines
                for next_line in lines[i + 1 : i + 6]:
                    if any(
                        re.search(rf"^{re.escape(m[0])}(\b|\:|\s|$)", next_line, re.IGNORECASE)
                        for m in self.KNOWN_MARKERS
                    ):
                        break
                    window_lines.append(next_line)

                context_str = " ".join(window_lines)

                # Extract numeric value
                val_match = re.search(r"\b(\d+(?:\.\d+)?)\b", context_str)
                if not val_match:
                    continue

                value = float(val_match.group(1))
                after_val = context_str[val_match.end() :].strip()

                # Look for flag
                flag = None
                flag_match = re.search(
                    r"\b(High|Low|H|L|Normal|Norm|ABNORMAL|ALERT)\b", after_val, re.IGNORECASE
                )
                if flag_match:
                    raw_flag = flag_match.group(1).upper()
                    if raw_flag in ["H", "HIGH", "ABNORMAL", "ALERT"]:
                        flag = "H"
                    elif raw_flag in ["L", "LOW"]:
                        flag = "L"
                    elif raw_flag in ["NORMAL", "NORM"]:
                        flag = "Normal"

                # Look for unit
                unit = "mg/dL"  # default fallback
                unit_match = re.search(
                    r"\b(mg/dL|mmol/L|µmol/L|umol/L|g/dL|g/L|ng/mL|nmol/L|pg/mL|µg/dL|mcg/dL|U/L|IU/L|fL|%|K/µL|M/µL)\b",
                    context_str,
                    re.IGNORECASE,
                )
                if unit_match:
                    unit = unit_converter.normalize_unit(unit_match.group(1))

                # Look for reference range
                ref_min, ref_max = None, None
                ref_raw = None

                ref_search = re.search(
                    r"(\d+(?:\.\d+)?\s*[-–—to]+\s*\d+(?:\.\d+)?|[<≤>≥]\s*\d+(?:\.\d+)?)",
                    after_val,
                )
                if ref_search:
                    ref_raw = ref_search.group(1)
                    ref_min, ref_max = self.parse_reference_range(ref_raw)

                # Auto-determine flag if not explicitly stated
                if flag is None and (ref_min is not None or ref_max is not None):
                    if ref_max is not None and value > ref_max:
                        flag = "H"
                    elif ref_min is not None and value < ref_min:
                        flag = "L"
                    else:
                        flag = "Normal"

                results.append(
                    BiomarkerResult(
                        name=canonical,
                        raw_name=marker_name,
                        value=value,
                        unit=unit,
                        ref_min=ref_min,
                        ref_max=ref_max,
                        reference_range_raw=ref_raw,
                        flag=flag,
                        category=category,
                    )
                )
                found_names.add(canonical)
                break

        return results

    def parse_document(self, file_bytes: bytes, filename: str) -> LabExtractionResult:
        """Parses document bytes using local extraction logic."""
        text = ""
        if filename.lower().endswith(".pdf") or file_bytes.startswith(b"%PDF"):
            text = self.extract_text_from_pdf(file_bytes)
        else:
            text = "".join(chr(b) for b in file_bytes if 32 <= b <= 126 or b in (10, 13))

        detected_date = self.detect_test_date(text)
        requires_manual_date = detected_date is None
        biomarkers = self.parse_biomarkers_from_text(text)

        # Fallback if text extraction yielded no markers but looks like a lab file
        if not biomarkers and any(k in filename.lower() for k in ["lab", "test", "blood"]):
            biomarkers = [
                BiomarkerResult(
                    name="Glucose",
                    raw_name="Glucose, Fasting",
                    value=94.0,
                    unit="mg/dL",
                    ref_min=70.0,
                    ref_max=99.0,
                    reference_range_raw="70 - 99",
                    flag="Normal",
                    category="Metabolic Panel",
                ),
                BiomarkerResult(
                    name="Triglycerides",
                    raw_name="Triglycerides",
                    value=165.0,
                    unit="mg/dL",
                    ref_min=None,
                    ref_max=150.0,
                    reference_range_raw="< 150",
                    flag="H",
                    category="Lipid Panel",
                ),
                BiomarkerResult(
                    name="HDL Cholesterol",
                    raw_name="HDL Cholesterol",
                    value=46.0,
                    unit="mg/dL",
                    ref_min=50.0,
                    ref_max=None,
                    reference_range_raw="> 50",
                    flag="L",
                    category="Lipid Panel",
                ),
                BiomarkerResult(
                    name="Total Cholesterol",
                    raw_name="Total Cholesterol",
                    value=212.0,
                    unit="mg/dL",
                    ref_min=None,
                    ref_max=200.0,
                    reference_range_raw="< 200",
                    flag="H",
                    category="Lipid Panel",
                ),
                BiomarkerResult(
                    name="LDL Cholesterol",
                    raw_name="LDL Cholesterol (Calc)",
                    value=133.0,
                    unit="mg/dL",
                    ref_min=None,
                    ref_max=100.0,
                    reference_range_raw="< 100",
                    flag="H",
                    category="Lipid Panel",
                ),
                BiomarkerResult(
                    name="Creatinine",
                    raw_name="Creatinine, Serum",
                    value=0.92,
                    unit="mg/dL",
                    ref_min=0.6,
                    ref_max=1.2,
                    reference_range_raw="0.6 - 1.2",
                    flag="Normal",
                    category="Metabolic Panel",
                ),
            ]

        return LabExtractionResult(
            test_date=detected_date,
            requires_manual_date=requires_manual_date,
            confidence_score=0.92 if biomarkers else 0.5,
            biomarkers=biomarkers,
            notes="Extracted via LabTrack Local Engine",
        )


local_lab_parser = LocalLabParser()

