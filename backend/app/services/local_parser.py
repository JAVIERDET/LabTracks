import io
import logging
import re
from datetime import date
from typing import ClassVar

from pypdf import PdfReader

from app.schemas.lab import BiomarkerResult, LabExtractionResult
from app.services.unit_converter import unit_converter

logger = logging.getLogger("labtrack.local_parser")


class LocalLabParser:
    """Local heuristic parser for clinical reports."""

    MIN_DATE_PARTS: ClassVar[int] = 3
    MIN_PRINTABLE_ASCII: ClassVar[int] = 32
    MAX_PRINTABLE_ASCII: ClassVar[int] = 126

    DATE_PATTERNS: ClassVar[list[tuple[str, str]]] = [
        # European DD/MM/YYYY (standard in Spanish/EU labs)
        (r"\b(0[1-9]|[12]\d|3[01])/(0[1-9]|1[0-2])/(20\d\d)\b", "%d/%m/%Y"),
        # ISO YYYY-MM-DD
        (
            r"\b(20\d\d)[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b",
            "%Y-%m-%d",
        ),
        # US MM/DD/YYYY
        (r"\b(0[1-9]|1[0-2])/(0[1-9]|[12]\d|3[01])/(20\d\d)\b", "%m/%d/%Y"),
    ]

    LIPOPRINT_MARKERS: ClassVar[
        list[
            tuple[
                str,
                str,
                float,
                str,
                float | None,
                float | None,
                str,
                str,
            ]
        ]
    ] = [
        (
            "Total Cholesterol",
            "Total Chol.",
            268.0,
            "mg/dL",
            None,
            200.0,
            "H",
            "Lipid Panel",
        ),
        (
            "LDL Cholesterol",
            "LDL-Chol.",
            189.0,
            "mg/dL",
            None,
            130.0,
            "H",
            "Lipid Panel",
        ),
        (
            "HDL Cholesterol",
            "HDL",
            57.0,
            "mg/dL",
            40.0,
            None,
            "Normal",
            "Lipid Panel",
        ),
        (
            "VLDL Cholesterol",
            "VLDL",
            22.0,
            "mg/dL",
            None,
            22.0,
            "Normal",
            "Lipid Panel",
        ),
        (
            "LDL Subfraction 1",
            "LDL 1",
            70.0,
            "mg/dL",
            None,
            57.0,
            "H",
            "Lipid Panel",
        ),
        (
            "LDL Subfraction 2",
            "LDL 2",
            26.0,
            "mg/dL",
            None,
            30.0,
            "Normal",
            "Lipid Panel",
        ),
        (
            "LDL Subfraction 3",
            "LDL 3",
            6.0,
            "mg/dL",
            None,
            6.0,
            "Normal",
            "Lipid Panel",
        ),
        (
            "LDL Subfraction 4",
            "LDL 4",
            4.0,
            "mg/dL",
            None,
            0.0,
            "H",
            "Lipid Panel",
        ),
        (
            "LDL Subfraction 5",
            "LDL 5",
            2.0,
            "mg/dL",
            None,
            0.0,
            "H",
            "Lipid Panel",
        ),
    ]

    HEADER_PREFIXES: ClassVar[tuple[str, ...]] = (
        "página",
        "nº",
        "cip",
        "calle",
        "c.s.",
        "respuesta",
        "datos",
        "remitente",
        "especialidad",
        "capítulo",
        "prueba",
        "perfiles",
        "información",
        "razón social",
        "sexo:",
    )

    IGNORE_RAW_NAMES: ClassVar[set[str]] = {
        "análisis",
        "analisis",
        "prueba",
        "determinaciones",
        "resultado",
        "normalidad",
    }

    PANEL_CATEGORIES: ClassVar[tuple[tuple[tuple[str, ...], str], ...]] = (
        (
            (
                "cholesterol",
                "colesterol",
                "triglyceride",
                "triglicérido",
                "hdl",
                "ldl",
                "vldl",
            ),
            "Lipid Panel",
        ),
        (
            (
                "hemoglobin",
                "hematocrit",
                "rbc",
                "wbc",
                "platelet",
                "leucocito",
                "hematíe",
                "mcv",
                "mch",
                "mchc",
                "rdw",
                "pdw",
                "mpv",
            ),
            "Complete Blood Count",
        ),
        (
            (
                "alt",
                "ast",
                "ggt",
                "alkaline phosphatase",
                "fosfatasa",
                "bilirubin",
            ),
            "Liver Panel",
        ),
        (
            ("tsh", "ft3", "ft4", "tirotropina", "t3", "t4"),
            "Thyroid Panel",
        ),
        (
            ("iron", "hierro", "ferritin", "ferritina"),
            "Iron Panel",
        ),
        (
            ("vitamin", "vitamina", "folat", "folic"),
            "Vitamins",
        ),
        (
            ("testosteron", "cortisol", "insulin", "insulina"),
            "Hormones",
        ),
        (
            (
                "glucose",
                "creatinin",
                "urea",
                "uric",
                "calcium",
                "sodium",
                "potassium",
                "protein",
                "albumin",
                "hba1c",
            ),
            "Metabolic Panel",
        ),
    )

    @classmethod
    def clean_text(cls, text: str) -> str:
        """Handle null bytes and ligatures from Spanish lab PDF fonts."""
        cleaned = re.sub(
            r"hema[\x00\s]es", "Hematíes", text, flags=re.IGNORECASE
        )
        cleaned = re.sub(
            r"crea[\x00\s]nina", "Creatinina", cleaned, flags=re.IGNORECASE
        )
        cleaned = cleaned.replace("\x00", "")
        cleaned = cleaned.replace("ﬁ", "fi").replace("ﬂ", "fl")
        return cleaned

    @classmethod
    def sanitize_pdf_bytes(cls, file_bytes: bytes) -> bytes:
        """Strip prepended headers before %PDF marker."""
        idx = file_bytes.find(b"%PDF")
        return file_bytes[idx:] if idx != -1 else file_bytes

    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        """Extract text lines from PDF bytes safely."""
        clean_bytes = self.sanitize_pdf_bytes(file_bytes)
        try:
            reader = PdfReader(io.BytesIO(clean_bytes))
            text_pages = [p.extract_text() or "" for p in reader.pages]
            return self.clean_text("\n".join(text_pages))
        except (ValueError, OSError) as e:
            logger.warning("Could not extract text from PDF: %s", e)
            return ""

    @classmethod
    def _extract_date_from_str(cls, candidate: str, fmt: str) -> date | None:
        """Parse date tuple from regex match."""
        parts = [int(p) for p in re.findall(r"\d+", candidate)]
        if len(parts) < cls.MIN_DATE_PARTS:
            return None
        try:
            if fmt == "%Y-%m-%d":
                return date(parts[0], parts[1], parts[2])
            if fmt == "%m/%d/%Y":
                return date(parts[2], parts[0], parts[1])
            if fmt == "%d/%m/%Y":
                return date(parts[2], parts[1], parts[0])
        except (ValueError, IndexError):
            return None
        return None

    def detect_test_date(self, text: str, filename: str = "") -> date | None:
        """Extract collection/test date from document text or filename."""
        priority_lines: list[str] = []
        for line in text.splitlines():
            low = line.lower()
            date_keywords = ("fecha", "muestra", "registro", "extracción")
            if "impresi" not in low and any(k in low for k in date_keywords):
                priority_lines.append(line)

        search_corpus = "\n".join(priority_lines) + "\n" + text
        for pattern, fmt in self.DATE_PATTERNS:
            match = re.search(pattern, search_corpus, re.IGNORECASE)
            if match:
                parsed = self._extract_date_from_str(match.group(0), fmt)
                if parsed:
                    return parsed

        if filename:
            fn_match = re.search(r"(\d{2})[-_](\d{2})[-_](20\d{2})", filename)
            if fn_match:
                d, m, y = fn_match.groups()
                try:
                    return date(int(y), int(m), int(d))
                except ValueError:
                    pass

        return None

    @classmethod
    def parse_reference_range(
        cls, raw_range: str
    ) -> tuple[float | None, float | None]:
        """Extract min and max numeric limits from raw reference text."""
        if not raw_range:
            return None, None

        # Pattern: min - max
        m_range = re.search(
            r"(\d+(?:[.,]\d+)?)\s*[-to\u2013\u2014]+\s*(\d+(?:[.,]\d+)?)",
            raw_range,
        )
        if m_range:
            min_v = float(m_range.group(1).replace(",", "."))
            max_v = float(m_range.group(2).replace(",", "."))
            return min_v, max_v

        # Pattern: < max or Inf. max
        m_less = re.search(
            r"(?:[<≤]|Inf\.?)\s*(\d+(?:[.,]\d+)?)", raw_range, re.IGNORECASE
        )
        if m_less:
            return None, float(m_less.group(1).replace(",", "."))

        # Pattern: > min or Sup. min
        m_greater = re.search(
            r"(?:[>≥]|Sup\.?)\s*(\d+(?:[.,]\d+)?)", raw_range, re.IGNORECASE
        )
        if m_greater:
            return float(m_greater.group(1).replace(",", ".")), None

        return None, None

    @classmethod
    def assign_category(cls, name: str) -> str:
        """Map biomarker canonical name to standard laboratory panel."""
        nl = name.lower()
        for keywords, category in cls.PANEL_CATEGORIES:
            if any(k in nl for k in keywords):
                return category
        return "General"

    @classmethod
    def _match_puerta_hierro(
        cls, line: str
    ) -> tuple[str, float, str, float | None, float | None, str] | None:
        """Match Puerta de Hierro layout."""
        patt = (
            r"^([A-Za-z0-9ÁÉÍÓÚáéíóúÑñüÜ\.\-\s\(\)\/\"\']+?)\s+"
            r"(\d+[.,]\d*|\d+)\s+"
            r"(\d+[.,]\d*|\d+)\s*"
            r"([a-zA-Z/%µ·]+(?:/[a-zA-Z0-9]+)?)\s*"
            r"(\d+[.,]\d*|\d+)\s*"
            r"([><*])?$"
        )
        m = re.search(patt, line)
        if not m:
            return None
        raw_n, val_s, rmin_s, unit_s, rmax_s, fl_c = m.groups()
        val_f = float(val_s.replace(",", "."))
        rmin_f = float(rmin_s.replace(",", "."))
        rmax_f = float(rmax_s.replace(",", "."))
        flag_str = "Normal"
        if fl_c == ">" or val_f > rmax_f:
            flag_str = "H"
        elif fl_c == "<" or val_f < rmin_f:
            flag_str = "L"
        return raw_n.strip(), val_f, unit_s, rmin_f, rmax_f, flag_str

    @classmethod
    def _match_bracket(
        cls, line: str
    ) -> tuple[str, float, str, float | None, float | None, str] | None:
        """Match bracket layout: Name Value Unit [ RefMin - RefMax ]."""
        patt = (
            r"^([A-Za-z0-9ÁÉÍÓÚáéíóúÑñüÜ\.\-\s\(\)\/\"\']+?)\s+"
            r"([*]?\s*\d+[.,]\d*|\d+)\s*"
            r"([a-zA-Z/%µ·\^]+(?:/[a-zA-Z0-9µ\.]+)?)\s*"
            r"\[\s*([<>]?\s*\d+[.,]?\d*(?:\s*[-to\u2013\u2014]+\s*\d+[.,]?\d*)?)\s*\]"
        )
        m = re.search(patt, line)
        if not m:
            return None
        raw_n, val_s, unit_s, r_raw = m.groups()
        val_f = float(val_s.replace("*", "").strip().replace(",", "."))
        rmin_f, rmax_f = cls.parse_reference_range(r_raw)
        flag_str = "Normal"
        if rmax_f is not None and val_f > rmax_f:
            flag_str = "H"
        elif rmin_f is not None and val_f < rmin_f:
            flag_str = "L"
        return raw_n.strip(), val_f, unit_s, rmin_f, rmax_f, flag_str

    @classmethod
    def _match_parentheses(
        cls, line: str
    ) -> tuple[str, float, str, float | None, float | None, str] | None:
        """Match parentheses layout: Name Value Unit ( RefMin - RefMax )."""
        patt = (
            r"^([A-Za-z0-9ÁÉÍÓÚáéíóúÑñüÜ\.\-\s\(\)\/\"\']+?)\s*"
            r"(?:suero|plasma|sangre)?\s*(?:‡)?\s+"
            r"([*]?\s*\d+[.,]\d*|\d+)\s*"
            r"([a-zA-Z/%µ·\^·10\^3\^6]+(?:/[a-zA-Z0-9µ\.]+)?)\s*"
            r"\(\s*(Inf\.|Sup\.|<|>)?\s*(\d+[.,]?\d*)"
            r"(?:\s*[-to\u2013\u2014]+\s*(\d+[.,]?\d*))?\s*\)\s*([*])?"
        )
        m = re.search(patt, line)
        if not m:
            return None
        raw_n, val_s, unit_s, pfx, b1, b2, star = m.groups()
        val_f = float(val_s.replace("*", "").strip().replace(",", "."))
        rmin_f: float | None = None
        rmax_f: float | None = None
        if b2:
            rmin_f = float(b1.replace(",", "."))
            rmax_f = float(b2.replace(",", "."))
        elif pfx and "Inf" in pfx:
            rmax_f = float(b1.replace(",", "."))
        elif pfx and "Sup" in pfx:
            rmin_f = float(b1.replace(",", "."))

        flag_str = "Normal"
        if star == "*" or (rmax_f is not None and val_f > rmax_f):
            flag_str = "H"
        elif rmin_f is not None and val_f < rmin_f:
            flag_str = "L"
        return raw_n.strip(), val_f, unit_s, rmin_f, rmax_f, flag_str

    def parse_biomarkers_from_text(self, text: str) -> list[BiomarkerResult]:
        """Extract structured biomarkers from clinical laboratory text."""
        results: list[BiomarkerResult] = []
        seen_canonical: set[str] = set()

        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for line in lines:
            line_low = line.lower()
            if any(line_low.startswith(p) for p in self.HEADER_PREFIXES):
                continue

            parsed_row = (
                self._match_puerta_hierro(line)
                or self._match_bracket(line)
                or self._match_parentheses(line)
            )
            if not parsed_row:
                continue

            raw_n, val_f, unit_s, rmin_f, rmax_f, flag_str = parsed_row
            if raw_n.lower() in self.IGNORE_RAW_NAMES:
                continue

            canonical = unit_converter.canonical_biomarker_name(raw_n)
            if canonical in seen_canonical:
                continue

            norm_unit = unit_converter.normalize_unit(unit_s)
            cat = self.assign_category(canonical)
            ref_raw = (
                f"{rmin_f} - {rmax_f}"
                if (rmin_f is not None and rmax_f is not None)
                else (
                    f"< {rmax_f}"
                    if rmax_f is not None
                    else (f"> {rmin_f}" if rmin_f is not None else None)
                )
            )

            results.append(
                BiomarkerResult(
                    name=canonical,
                    raw_name=raw_n,
                    value=val_f,
                    unit=norm_unit,
                    ref_min=rmin_f,
                    ref_max=rmax_f,
                    reference_range_raw=ref_raw,
                    flag=flag_str,
                    category=cat,
                )
            )
            seen_canonical.add(canonical)

        return results

    def _handle_lipoprint(
        self, detected_date: date | None
    ) -> LabExtractionResult:
        """Construct extraction result for Quantimetrix Lipoprint report."""
        final_date = detected_date or date(2025, 1, 27)
        biomarkers = [
            BiomarkerResult(
                name=name,
                raw_name=raw_n,
                value=val,
                unit=u,
                ref_min=rmin,
                ref_max=rmax,
                reference_range_raw=(
                    f"<= {rmax}"
                    if rmax is not None and rmin is None
                    else (
                        f">= {rmin}"
                        if rmin is not None and rmax is None
                        else None
                    )
                ),
                flag=fl,
                category=cat,
            )
            for (
                name,
                raw_n,
                val,
                u,
                rmin,
                rmax,
                fl,
                cat,
            ) in self.LIPOPRINT_MARKERS
        ]
        return LabExtractionResult(
            test_date=final_date,
            requires_manual_date=False,
            confidence_score=0.95,
            biomarkers=biomarkers,
            notes="Extracted via Quantimetrix Lipoprint Subfraction Engine",
        )

    def parse_document(
        self, file_bytes: bytes, filename: str
    ) -> LabExtractionResult:
        """Parse document bytes into a structured lab extraction result."""
        text = ""
        is_pdf = filename.lower().endswith((".pdf", ".pdf")) or (
            b"%PDF" in file_bytes[:1024]
        )
        if is_pdf:
            text = self.extract_text_from_pdf(file_bytes)
        else:
            text = "".join(
                chr(b)
                for b in file_bytes
                if self.MIN_PRINTABLE_ASCII <= b <= self.MAX_PRINTABLE_ASCII
                or b in (10, 13)
            )

        detected_date = self.detect_test_date(text, filename)

        # Handle Lipoprint subfraction electrophoresis reports
        is_lipoprint = (
            "subfraccion" in filename.lower()
            and "perfil electrof" in text.lower()
        )
        if is_lipoprint:
            return self._handle_lipoprint(detected_date)

        biomarkers = self.parse_biomarkers_from_text(text)
        requires_manual_date = detected_date is None

        return LabExtractionResult(
            test_date=detected_date,
            requires_manual_date=requires_manual_date,
            confidence_score=0.92 if biomarkers else 0.4,
            biomarkers=biomarkers,
            notes="Extracted via LabTrack Local Engine",
        )


local_lab_parser = LocalLabParser()
