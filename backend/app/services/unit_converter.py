import re
from typing import Dict, List, Optional, Tuple


class UnitConverter:
    """Medical unit normalization and conversion service for blood biomarkers."""

    # Canonical unit mappings
    UNIT_NORMALIZATION: Dict[str, str] = {
        "mg/dl": "mg/dL",
        "mg/dl.": "mg/dL",
        "mg / dl": "mg/dL",
        "mg%": "mg/dL",
        "mmol/l": "mmol/L",
        "mmol / l": "mmol/L",
        "umol/l": "µmol/L",
        "µmol/l": "µmol/L",
        "u mol/l": "µmol/L",
        "g/dl": "g/dL",
        "g / dl": "g/dL",
        "g/l": "g/L",
        "g / l": "g/L",
        "ng/ml": "ng/mL",
        "ng / ml": "ng/mL",
        "nmol/l": "nmol/L",
        "nmol / l": "nmol/L",
        "pg/ml": "pg/mL",
        "pg / ml": "pg/mL",
        "ug/dl": "µg/dL",
        "µg/dl": "µg/dL",
        "mcg/dl": "µg/dL",
        "u/l": "U/L",
        "iu/l": "IU/L",
        "miu/l": "mIU/L",
        "uiu/ml": "µIU/mL",
        "u/ml": "U/mL",
        "fl": "fL",
        "%": "%",
        "percent": "%",
        "cells/ul": "cells/µL",
        "k/ul": "K/µL",
        "m/ul": "M/µL",
        "thous/mcl": "K/µL",
        "mil/mcl": "M/µL",
    }

    # Standardized biomarker names dictionary with synonyms
    BIOMARKER_CANONICAL_NAMES: Dict[str, str] = {
        "glucose": "Glucose",
        "fasting glucose": "Glucose",
        "blood sugar": "Glucose",
        "serum glucose": "Glucose",
        "fasting blood sugar": "Glucose",
        "fbs": "Glucose",
        "total cholesterol": "Total Cholesterol",
        "cholesterol, total": "Total Cholesterol",
        "cholesterol total": "Total Cholesterol",
        "cholesterol": "Total Cholesterol",
        "serum cholesterol": "Total Cholesterol",
        "chol": "Total Cholesterol",
        "hdl": "HDL Cholesterol",
        "hdl cholesterol": "HDL Cholesterol",
        "hdl-c": "HDL Cholesterol",
        "hdl c": "HDL Cholesterol",
        "high density lipoprotein": "HDL Cholesterol",
        "ldl": "LDL Cholesterol",
        "ldl cholesterol": "LDL Cholesterol",
        "ldl-c": "LDL Cholesterol",
        "ldl c": "LDL Cholesterol",
        "low density lipoprotein": "LDL Cholesterol",
        "ldl (calculated)": "LDL Cholesterol",
        "ldl calculated": "LDL Cholesterol",
        "ldl calc": "LDL Cholesterol",
        "triglycerides": "Triglycerides",
        "tg": "Triglycerides",
        "serum triglycerides": "Triglycerides",
        "total protein": "Total Protein",
        "protein, total": "Total Protein",
        "protein total": "Total Protein",
        "serum protein": "Total Protein",
        "albumin": "Albumin",
        "serum albumin": "Albumin",
        "creatinine": "Creatinine",
        "serum creatinine": "Creatinine",
        "total bilirubin": "Total Bilirubin",
        "bilirubin, total": "Total Bilirubin",
        "bilirubin total": "Total Bilirubin",
        "bilirubin": "Total Bilirubin",
        "calcium": "Calcium",
        "serum calcium": "Calcium",
        "total calcium": "Calcium",
        "blood urea nitrogen": "Blood Urea Nitrogen (BUN)",
        "blood urea nitrogen (bun)": "Blood Urea Nitrogen (BUN)",
        "bun": "Blood Urea Nitrogen (BUN)",
        "urea nitrogen": "Blood Urea Nitrogen (BUN)",
        "urea": "Urea",
        "uric acid": "Uric Acid",
        "serum uric acid": "Uric Acid",
        "vitamin d": "Vitamin D (25-OH)",
        "vitamin d, 25-hydroxy": "Vitamin D (25-OH)",
        "25-hydroxyvitamin d": "Vitamin D (25-OH)",
        "vitamin d (25-oh)": "Vitamin D (25-OH)",
        "vitamin d 25-oh": "Vitamin D (25-OH)",
        "vitamin d 25 oh": "Vitamin D (25-OH)",
        "hemoglobin": "Hemoglobin",
        "hgb": "Hemoglobin",
        "hb": "Hemoglobin",
        "hba1c": "HbA1c",
        "glycated hemoglobin": "HbA1c",
        "hemoglobin a1c": "HbA1c",
        "potassium": "Potassium",
        "sodium": "Sodium",
        "chloride": "Chloride",
        "carbon dioxide": "Carbon Dioxide",
        "co2": "Carbon Dioxide",
        "ast": "AST (SGOT)",
        "alt": "ALT (SGPT)",
        "alkaline phosphatase": "Alkaline Phosphatase",
        "alp": "Alkaline Phosphatase",
        "tsh": "TSH",
        "ferritin": "Ferritin",
    }

    # Conversion definitions:
    CONVERSION_FAMILIES: Dict[str, List[str]] = {
        "glucose": ["mg/dL", "mmol/L"],
        "cholesterol": ["mg/dL", "mmol/L"],
        "triglycerides": ["mg/dL", "mmol/L"],
        "protein": ["g/dL", "g/L"],
        "creatinine": ["mg/dL", "µmol/L"],
        "bilirubin": ["mg/dL", "µmol/L"],
        "calcium": ["mg/dL", "mmol/L"],
        "bun": ["mg/dL", "mmol/L"],
        "urea": ["mg/dL", "mmol/L"],
        "uric_acid": ["mg/dL", "µmol/L"],
        "vitamin_d": ["ng/mL", "nmol/L"],
        "hemoglobin": ["g/dL", "g/L", "mmol/L"],
    }

    @classmethod
    def normalize_unit(cls, unit: Optional[str]) -> str:
        if not unit:
            return ""
        clean = unit.strip().lower()
        clean = re.sub(r"\s+", " ", clean)
        return cls.UNIT_NORMALIZATION.get(clean, unit.strip())

    @classmethod
    def canonical_biomarker_name(cls, raw_name: str) -> str:
        if not raw_name:
            return ""
        clean_raw = raw_name.strip().lower()
        if clean_raw in cls.BIOMARKER_CANONICAL_NAMES:
            return cls.BIOMARKER_CANONICAL_NAMES[clean_raw]

        clean = re.sub(r"[\*:]", " ", clean_raw)
        clean = re.sub(r"\s+", " ", clean).strip()
        if clean in cls.BIOMARKER_CANONICAL_NAMES:
            return cls.BIOMARKER_CANONICAL_NAMES[clean]

        clean_no_parens = re.sub(r"[\(\)]", " ", clean)
        clean_no_parens = re.sub(r"\s+", " ", clean_no_parens).strip()
        if clean_no_parens in cls.BIOMARKER_CANONICAL_NAMES:
            return cls.BIOMARKER_CANONICAL_NAMES[clean_no_parens]

        return raw_name.strip()

    @classmethod
    def get_category_key(cls, biomarker_name: str) -> Optional[str]:
        name_lower = biomarker_name.lower()
        if "glucose" in name_lower or "blood sugar" in name_lower or "fbs" in name_lower:
            return "glucose"
        elif "triglyceride" in name_lower:
            return "triglycerides"
        elif any(k in name_lower for k in ["cholesterol", "hdl", "ldl"]):
            return "cholesterol"
        elif "protein" in name_lower or "albumin" in name_lower:
            return "protein"
        elif "creatinine" in name_lower:
            return "creatinine"
        elif "bilirubin" in name_lower:
            return "bilirubin"
        elif "calcium" in name_lower:
            return "calcium"
        elif "bun" in name_lower or "blood urea nitrogen" in name_lower:
            return "bun"
        elif "urea" in name_lower:
            return "urea"
        elif "uric" in name_lower:
            return "uric_acid"
        elif "vitamin d" in name_lower or "25-oh" in name_lower:
            return "vitamin_d"
        elif "hemoglobin" in name_lower or name_lower in ["hgb", "hb"]:
            return "hemoglobin"
        return None

    @classmethod
    def get_available_units(cls, biomarker_name: str, current_unit: Optional[str] = None) -> List[str]:
        cat = cls.get_category_key(biomarker_name)
        if cat and cat in cls.CONVERSION_FAMILIES:
            units = list(cls.CONVERSION_FAMILIES[cat])
            if current_unit:
                norm_current = cls.normalize_unit(current_unit)
                if norm_current and norm_current not in units:
                    units.append(norm_current)
            return units

        if current_unit:
            return [cls.normalize_unit(current_unit)]
        return []

    @classmethod
    def convert_value(
        cls, biomarker_name: str, value: Optional[float], from_unit: str, to_unit: str
    ) -> Optional[float]:
        if value is None:
            return None

        norm_from = cls.normalize_unit(from_unit)
        norm_to = cls.normalize_unit(to_unit)

        if norm_from == norm_to or not norm_from or not norm_to:
            return round(value, 4)

        cat = cls.get_category_key(biomarker_name)

        # Glucose: 1 mmol/L = 18.0182 mg/dL
        if cat == "glucose":
            if norm_from == "mg/dL" and norm_to == "mmol/L":
                return round(value / 18.0182, 2)
            elif norm_from == "mmol/L" and norm_to == "mg/dL":
                return round(value * 18.0182, 1)

        # Cholesterol, HDL, LDL: 1 mmol/L = 38.67 mg/dL
        elif cat == "cholesterol":
            if norm_from == "mg/dL" and norm_to == "mmol/L":
                return round(value / 38.67, 2)
            elif norm_from == "mmol/L" and norm_to == "mg/dL":
                return round(value * 38.67, 1)

        # Triglycerides: 1 mmol/L = 88.57 mg/dL
        elif cat == "triglycerides":
            if norm_from == "mg/dL" and norm_to == "mmol/L":
                return round(value / 88.57, 2)
            elif norm_from == "mmol/L" and norm_to == "mg/dL":
                return round(value * 88.57, 1)

        # Total Protein / Albumin: 1 g/dL = 10 g/L
        elif cat == "protein":
            if norm_from == "g/dL" and norm_to == "g/L":
                return round(value * 10.0, 1)
            elif norm_from == "g/L" and norm_to == "g/dL":
                return round(value / 10.0, 2)

        # Creatinine: 1 mg/dL = 88.4 µmol/L
        elif cat == "creatinine":
            if norm_from == "mg/dL" and (norm_to == "µmol/L" or norm_to == "umol/L"):
                return round(value * 88.4, 1)
            elif (norm_from == "µmol/L" or norm_from == "umol/L") and norm_to == "mg/dL":
                return round(value / 88.4, 2)

        # Bilirubin: 1 mg/dL = 17.1 µmol/L
        elif cat == "bilirubin":
            if norm_from == "mg/dL" and (norm_to == "µmol/L" or norm_to == "umol/L"):
                return round(value * 17.1, 1)
            elif (norm_from == "µmol/L" or norm_from == "umol/L") and norm_to == "mg/dL":
                return round(value / 17.1, 2)

        # Calcium: 1 mmol/L = 4.008 mg/dL
        elif cat == "calcium":
            if norm_from == "mg/dL" and norm_to == "mmol/L":
                return round(value / 4.008, 2)
            elif norm_from == "mmol/L" and norm_to == "mg/dL":
                return round(value * 4.008, 2)

        # BUN: 1 mmol/L = 2.8 mg/dL
        elif cat == "bun":
            if norm_from == "mg/dL" and norm_to == "mmol/L":
                return round(value / 2.8, 2)
            elif norm_from == "mmol/L" and norm_to == "mg/dL":
                return round(value * 2.8, 1)

        # Urea: 1 mmol/L = 6.0 mg/dL
        elif cat == "urea":
            if norm_from == "mg/dL" and norm_to == "mmol/L":
                return round(value / 6.0, 2)
            elif norm_from == "mmol/L" and norm_to == "mg/dL":
                return round(value * 6.0, 1)

        # Uric Acid: 1 mg/dL = 59.48 µmol/L
        elif cat == "uric_acid":
            if norm_from == "mg/dL" and (norm_to == "µmol/L" or norm_to == "umol/L"):
                return round(value * 59.48, 1)
            elif (norm_from == "µmol/L" or norm_from == "umol/L") and norm_to == "mg/dL":
                return round(value / 59.48, 2)

        # Vitamin D: 1 ng/mL = 2.496 nmol/L
        elif cat == "vitamin_d":
            if norm_from == "ng/mL" and norm_to == "nmol/L":
                return round(value * 2.496, 1)
            elif norm_from == "nmol/L" and norm_to == "ng/mL":
                return round(value / 2.496, 1)

        # Hemoglobin: 1 g/dL = 10 g/L; 1 mmol/L = 1.611 g/dL
        elif cat == "hemoglobin":
            if norm_from == "g/dL" and norm_to == "g/L":
                return round(value * 10.0, 1)
            elif norm_from == "g/L" and norm_to == "g/dL":
                return round(value / 10.0, 2)
            elif norm_from == "g/dL" and norm_to == "mmol/L":
                return round(value / 1.611, 2)
            elif norm_from == "mmol/L" and norm_to == "g/dL":
                return round(value * 1.611, 2)
            elif norm_from == "g/L" and norm_to == "mmol/L":
                return round((value / 10.0) / 1.611, 2)
            elif norm_from == "mmol/L" and norm_to == "g/L":
                return round((value * 1.611) * 10.0, 1)

        # Direct 10x or 1000x prefixes if recognized
        if (norm_from == "g/dL" and norm_to == "g/L") or (norm_from == "mg/dL" and norm_to == "mg/L"):
            return round(value * 10.0, 2)
        elif (norm_from == "g/L" and norm_to == "g/dL") or (norm_from == "mg/L" and norm_to == "mg/dL"):
            return round(value / 10.0, 2)

        # Fallback if unknown conversion
        return round(value, 4)

    @classmethod
    def convert_datapoint(
        cls,
        biomarker_name: str,
        value: float,
        ref_min: Optional[float],
        ref_max: Optional[float],
        from_unit: str,
        to_unit: str,
    ) -> Tuple[float, Optional[float], Optional[float], str]:
        """Converts value, ref_min, and ref_max all at once and returns the target unit."""
        norm_to = cls.normalize_unit(to_unit)
        c_val = cls.convert_value(biomarker_name, value, from_unit, norm_to)
        c_min = cls.convert_value(biomarker_name, ref_min, from_unit, norm_to) if ref_min is not None else None
        c_max = cls.convert_value(biomarker_name, ref_max, from_unit, norm_to) if ref_max is not None else None
        return (c_val if c_val is not None else value, c_min, c_max, norm_to)


unit_converter = UnitConverter()

