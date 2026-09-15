import re
import unicodedata
from typing import ClassVar


class UnitConverter:
    """Medical unit normalization and conversion service for biomarkers."""

    MIN_ALIAS_LEN_FOR_SUBSTRING: ClassVar[int] = 5

    # Canonical unit mappings
    UNIT_NORMALIZATION: ClassVar[dict[str, str]] = {
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
        "ui/l": "U/L",
        "miu/l": "mIU/L",
        "uiu/ml": "µIU/mL",
        "µiu/ml": "µIU/mL",
        "u/ml": "U/mL",
        "fl": "fL",
        "%": "%",
        "percent": "%",
        "cells/ul": "cells/µL",
        "k/ul": "K/µL",
        "m/ul": "M/µL",
        "thous/mcl": "K/µL",
        "mil/mcl": "M/µL",
        "·10³/µl": "10^3/µL",
        "·10^3/µl": "10^3/µL",
        "10³/µl": "10^3/µL",
        "10^3/µl": "10^3/µL",
        "·10^6/µl": "10^6/µL",
        "10⁶/µl": "10^6/µL",
        "10^6/µl": "10^6/µL",
    }

    # Standardized biomarker definitions:
    # Key: English canonical display name
    # Value: Tuple of English and Spanish aliases, synonyms, and variations
    CANONICAL_BIOMARKER_DEFINITIONS: ClassVar[dict[str, tuple[str, ...]]] = {
        # --- Lipid Panel ---
        "Total Cholesterol": (
            "total cholesterol",
            "cholesterol, total",
            "cholesterol total",
            "cholesterol",
            "serum cholesterol",
            "chol",
            "colesterol total",
            "colesterol total suero",
            "colesterol",
            "colesterolemia",
            "colesterol en suero",
        ),
        "HDL Cholesterol": (
            "hdl",
            "hdl cholesterol",
            "hdl-c",
            "hdl c",
            "high density lipoprotein",
            "high-density lipoprotein",
            "colesterol-hdl",
            "colesterol hdl",
            "hdl colesterol",
            "hdl colesterol suero",
            "c-hdl",
            "colesterol de hdl",
            "hdl-colesterol",
            "colesterol ligado a hdl",
            "colesterol en hdl",
        ),
        "LDL Cholesterol": (
            "ldl",
            "ldl cholesterol",
            "ldl-c",
            "ldl c",
            "low density lipoprotein",
            "low-density lipoprotein",
            "ldl (calculated)",
            "ldl calculated",
            "ldl calc",
            "colesterol ldl",
            "ldl colesterol",
            "colesterol ldl (calculado)",
            "colesterol ldl (formula de friedewald)",
            "ldl-chol.",
            "colesterol-ldl",
            "c-ldl",
            "ldl directo",
            "colesterol ligado a ldl",
            "colesterol de ldl",
            "colesterol en ldl",
        ),
        "Non-HDL Cholesterol": (
            "non-hdl cholesterol",
            "non hdl cholesterol",
            "non-hdl",
            "non hdl",
            "colesterol no hdl",
            "colesterol no-hdl",
            "no-hdl",
            "c-no-hdl",
            "colesterol no hdl (calculado)",
        ),
        "VLDL Cholesterol": (
            "vldl",
            "vldl cholesterol",
            "very low density lipoprotein",
            "vldl colesterol",
            "vldl colesterol suero",
            "c-vldl",
            "colesterol vldl",
        ),
        "Triglycerides": (
            "triglycerides",
            "triglyceride",
            "tg",
            "serum triglycerides",
            "triglicéridos",
            "trigliceridos",
            "triglicéridos suero",
            "trigliceridos suero",
            "triglicéridos en suero",
        ),
        "Lipoprotein (a)": (
            "lipoprotein (a)",
            "lipoprotein a",
            "lipoproteina (a)",
            "lipoproteína (a)",
            "lipoproteina a",
            "lipoproteína a",
            "lp(a)",
            "lpa",
        ),
        "Apolipoprotein A1": (
            "apolipoprotein a1",
            "apolipoproteina a1",
            "apolipoproteína a1",
            "apoa1",
            "apo a1",
            "apo a-1",
        ),
        "Apolipoprotein B": (
            "apolipoprotein b",
            "apolipoproteina b",
            "apolipoproteína b",
            "apob",
            "apo b",
        ),
        # --- Glycemic & Metabolic Panel ---
        "Glucose": (
            "glucose",
            "fasting glucose",
            "blood sugar",
            "serum glucose",
            "fasting blood sugar",
            "fbs",
            "glucosa",
            "glucosa (suero/plasma)",
            "glucosa plasma",
            "glucosa basal",
            "glucemia",
            "glicemia",
            "glucosa en suero",
        ),
        "HbA1c": (
            "hba1c",
            "glycated hemoglobin",
            "hemoglobin a1c",
            "hemoglobina a1c",
            "hemoglobina a1c (ngsp) por hplc",
            "hemoglobina glicada (hba1c)",
            "hemoglobina a1c (ifcc) por hplc",
            "hba1c (ifcc)",
            "hba1c (ngsp)",
            "a1c",
            "hemoglobina glicosilada",
        ),
        "Insulin": (
            "insulin",
            "fasting insulin",
            "serum insulin",
            "insulina",
            "insulina basal",
            "insulinemia",
            "insulina en suero",
        ),
        "HOMA-IR": (
            "homa-ir",
            "homa",
            "homa index",
            "resistencia insulínica",
            "resistencia insulinica",
            "índice homa",
            "indice homa",
        ),
        "Fructosamine": (
            "fructosamine",
            "fructosamina",
        ),
        # --- Liver Panel ---
        "ALT (SGPT)": (
            "alt",
            "alt (sgpt)",
            "sgpt",
            "alat",
            "alat (gpt)",
            "alt (gpt)",
            "alt (gpt) suero",
            "gpt (alt)",
            "gpt",
            "transaminasa gpt",
            "transaminasa alt",
            "alanina aminotransferasa",
        ),
        "AST (SGOT)": (
            "ast",
            "ast (sgot)",
            "sgot",
            "asat",
            "asat (got)",
            "ast (got)",
            "ast (got) suero",
            "got (ast)",
            "got",
            "transaminasa got",
            "transaminasa ast",
            "aspartato aminotransferasa",
        ),
        "GGT": (
            "ggt",
            "gamma-gt",
            "gamma gt",
            "gamma - gt",
            "gamma-gt suero",
            "gama gt",
            "gama-gt",
            "gamma glutamil transferasa",
            "gamma-glutamiltransferasa",
            "g-gt",
        ),
        "Alkaline Phosphatase": (
            "alkaline phosphatase",
            "alp",
            "fosfatasa alcalina",
            "fosfatasa alcalina (alp)",
            "fosfatasa alc.",
        ),
        "Total Bilirubin": (
            "total bilirubin",
            "bilirubin, total",
            "bilirubin total",
            "bilirubin",
            "bilirrubina total",
            "bilirrubina",
            "bilirrubina total suero",
        ),
        "Direct Bilirubin": (
            "direct bilirubin",
            "bilirubin direct",
            "bilirrubina directa",
            "bilirrubina directa (conjugada)",
            "bilirrubina conjugada",
        ),
        "Indirect Bilirubin": (
            "indirect bilirubin",
            "bilirubin indirect",
            "bilirrubina indirecta",
            "bilirrubina no conjugada",
        ),
        "Fatty Liver Index (FLI)": (
            "fatty liver index",
            "fli",
            "índice de hígado graso",
            "indice de higado graso",
        ),
        # --- Kidney & Renal Function ---
        "Creatinine": (
            "creatinine",
            "serum creatinine",
            "creatinina",
            "crea nina",
            "creatinina suero",
            "creatinina en suero",
        ),
        "Creatinine Clearance": (
            "aclaramiento de creatinina",
            "aclaramiento de creatinina en orina",
            "creatinine clearance",
            "crcl",
        ),
        "Blood Urea Nitrogen (BUN)": (
            "blood urea nitrogen",
            "blood urea nitrogen (bun)",
            "bun",
            "urea nitrogen",
            "nitrógeno ureico",
            "nitrogeno ureico",
        ),
        "Urea": (
            "urea",
            "serum urea",
            "urea suero",
            "urea en suero",
        ),
        "Uric Acid": (
            "uric acid",
            "serum uric acid",
            "ácido úrico",
            "acido urico",
            "ácido úrico suero",
            "acido urico suero",
            "ac. urico",
            "ac. úrico",
            "ac úrico",
            "ac urico",
            "urato",
            "urato en suero",
        ),
        "Total Protein": (
            "total protein",
            "protein, total",
            "protein total",
            "serum protein",
            "proteínas totales",
            "proteinas totales",
            "proteinemia",
        ),
        "Albumin": (
            "albumin",
            "serum albumin",
            "albúmina",
            "albumina",
            "albúmina suero",
            "albumina suero",
        ),
        # --- Electrolytes & Minerals ---
        "Sodium": (
            "sodium",
            "sodio",
            "natremia",
            "na",
        ),
        "Potassium": (
            "potassium",
            "potasio",
            "potasemia",
            "k",
        ),
        "Chloride": (
            "chloride",
            "cloro",
            "cloruro",
            "cloremia",
            "cl",
        ),
        "Calcium": (
            "calcium",
            "serum calcium",
            "total calcium",
            "calcio",
            "calcio total",
            "calcemia",
            "calcio corregido por albúmina",
            "calcio corregido",
        ),
        "Phosphorus": (
            "phosphorus",
            "phosphate",
            "fósforo",
            "fosforo",
            "fosfatemia",
            "p",
        ),
        "Magnesium": (
            "magnesium",
            "magnesio",
            "magnesemia",
            "mg",
        ),
        "Iron": (
            "iron",
            "hierro",
            "sideremia",
            "fe",
            "hierro suero",
            "hierro sérico",
            "hierro serico",
        ),
        "Ferritin": (
            "ferritin",
            "serum ferritin",
            "ferritina",
            "ferrina",
            "ferritina suero",
        ),
        "Transferrin": (
            "transferrin",
            "transferrina",
            "transferrina suero",
        ),
        "Transferrin Saturation": (
            "transferrin saturation",
            "saturación de transferrina",
            "indice de saturación de transferrina",
            "índice de saturación de transferrina",
            "saturacion de transferrina",
            "ist",
        ),
        "Zinc": (
            "zinc",
            "zinc suero",
            "cinc",
            "zn",
        ),
        "Selenium": (
            "selenium",
            "selenio",
            "se",
        ),
        # --- Inflammation & Cardiovascular ---
        "C-Reactive Protein": (
            "c-reactive protein",
            "crp",
            "pcr",
            "proteína c reactiva",
            "proteina c reactiva",
            'proteina "c" reactiva',
            'proteína "c" reactiva',
            "proteína c reacva",
            "proteina c reacva",
            "proteína c reactiva en suero",
            "pcr ultrasensible",
            "hs-crp",
        ),
        "Homocysteine": (
            "homocysteine",
            "homocisteina",
            "homocisteína",
        ),
        "Rheumatoid Factor": (
            "rheumatoid factor",
            "factor reumatoide",
            "fr",
            "rf",
        ),
        "ASO (Antistreptolysin O)": (
            "antiestreptolisina o",
            'antiestreptolisina " o "',
            "antiestreptolisina",
            "antistreptolysin o",
            "aso",
            "aslo",
        ),
        # --- Vitamins ---
        "Vitamin D (25-OH)": (
            "vitamin d",
            "vitamin d, 25-hydroxy",
            "25-hydroxyvitamin d",
            "vitamin d (25-oh)",
            "vitamin d 25-oh",
            "vitamin d 25 oh",
            "vitamina d",
            "vitamina d (25 oh)",
            "vitamina d 25-hidroxi",
            "vitamina d 25 hidroxi",
            "25-hidroxivitamina d",
            "vitamina d3 (25-oh)",
        ),
        "Vitamin B12": (
            "vitamin b12",
            "vitamina b12",
            "b12",
            "cobalamina",
            "cobalamin",
        ),
        "Vitamin B1": (
            "vitamin b1",
            "vitamina b1",
            "vitamina b1 (tiamina)",
            "tiamina",
            "thiamine",
        ),
        "Vitamin B6": (
            "vitamin b6",
            "vitamina b6",
            "vitamina b6 (piridoxal fosfato)",
            "piridoxal fosfato",
            "pyridoxine",
        ),
        "Folate": (
            "folate",
            "folic acid",
            "ácido fólico",
            "acido folico",
            "ac. fólico",
            "ac. folico",
            "ácido fólico (vitamina b9)",
            "acido folico (vitamina b9)",
            "vitamina b9",
        ),
        # --- Thyroid ---
        "TSH": (
            "tsh",
            "t.s.h.",
            "tirotropina (tsh)",
            "tirotropina",
            "hormona estimulante de la tiroides",
            "thyroid stimulating hormone",
        ),
        "Free T3": (
            "free t3",
            "ft3",
            "t3 libre",
            "triyodotironina libre",
            "triyodotironina libre ( ft3 )",
            "triyodotironina libre (ft3)",
        ),
        "Total T3": (
            "total t3",
            "t3",
            "t3 total",
            "triyodotironina total",
            "triyodotironina",
        ),
        "Free T4": (
            "free t4",
            "ft4",
            "t4 libre",
            "tiroxina libre",
            "tiroxina libre ( ft4 )",
            "tiroxina libre (ft4)",
        ),
        "Total T4": (
            "total t4",
            "t4",
            "t4 total",
            "tiroxina total",
            "tiroxina",
        ),
        "Reverse T3": (
            "reverse t3",
            "t3 reverse",
            "rt3",
            "t3 reversa",
        ),
        "Anti-Thyroglobulin Antibodies": (
            "anti-thyroglobulin antibodies",
            "ac anti-tiroglobulina",
            "anticuerpos anti-tiroglobulina",
            "anti-tg",
        ),
        # --- Hematology (CBC) & Coagulation ---
        "Hemoglobin": (
            "hemoglobin",
            "hgb",
            "hb",
            "hemoglobina",
            "hemoglobina total",
        ),
        "Hematocrit": (
            "hematocrit",
            "hematocrito",
            "hto",
            "htc",
        ),
        "RBC": (
            "rbc",
            "red blood cells",
            "hematíes",
            "hematies",
            "glóbulos rojos",
            "globulos rojos",
            "recuento de hematíes",
            "eritrocitos",
        ),
        "WBC": (
            "wbc",
            "white blood cells",
            "leucocitos",
            "glóbulos blancos",
            "globulos blancos",
            "recuento de leucocitos",
        ),
        "Platelets": (
            "platelets",
            "plaquetas",
            "plt",
            "recuento de plaquetas",
        ),
        "MCV": (
            "mcv",
            "vcm",
            "v.c.m",
            "volumen corpuscular medio",
            "volumen corpuscular medio (vcm)",
        ),
        "MCH": (
            "mch",
            "hcm",
            "h.c.m",
            "hemoglobina corpuscular media",
            "hemoglobina corpuscular media (hcm)",
        ),
        "MCHC": (
            "mchc",
            "chcm",
            "c.h.c.m",
            "conc. hemogl. corp. media",
            "concentración de hemoglobina corpuscular media",
        ),
        "RDW": (
            "rdw",
            "ade",
            "índice de anisocitosis",
            "indice de anisocitosis",
            "índice de anisocitosis (rdw)",
            "indice de anisocitosis (rdw)",
            "ancho de distribución eritrocitaria",
        ),
        "MPV": (
            "mpv",
            "vpm",
            "volumen plaquetar medio (vpm)",
            "volumen plaquetario medio",
        ),
        "PDW": (
            "pdw",
            "distribución plaquetaria",
            "distribucion plaquetaria",
        ),
        "Plateletcrit": (
            "plateletcrit",
            "plaquetocrito",
            "pct",
        ),
        "Prothrombin Time": (
            "prothrombin time",
            "tiempo de protrombina",
            "actividad de protrombina (i. quick)",
            "actividad de protrombina",
            "tiempo de protrombina (tp)",
            "indice de quick",
            "índice de quick",
            "pt",
            "inr",
        ),
        "Prothrombin Control Time": (
            "tiempo control",
            "prothrombin control time",
            "control time",
        ),
        # --- Hormones & Tumor Markers & Others ---
        "Cortisol": (
            "cortisol",
            "cortisol basal",
            "cortisolemia",
        ),
        "ACTH": (
            "acth",
            "hormona adrenocorticotropa",
            "adrenocorticotropic hormone",
        ),
        "Growth Hormone (GH)": (
            "growth hormone",
            "gh",
            "hormona del crecimiento (somatotropina)",
            "hormona del crecimiento",
            "somatotropina",
        ),
        "Testosterone": (
            "testosterone",
            "testosterona",
            "testosterona total",
        ),
        "DHEA-S": (
            "dhea-s",
            "dheas",
            "dhea",
            "dehidroepiandrosterona",
            "dehidroepiandrosterona-sulfato",
        ),
        "PSA": (
            "psa",
            "antígeno prostático específico",
            "antigeno prostatico especifico",
            "ag prostatico especifico (psa)",
            "psa total",
        ),
        "Free PSA": (
            "free psa",
            "psa libre",
            "psa - libre",
            "psa-libre",
        ),
        "Free PSA / Total PSA Ratio": (
            "indice psa libre/psa",
            "índice psa libre/psa",
            "free psa / total psa ratio",
            "ratio psa libre/total",
        ),
        "Serotonin": (
            "serotonin",
            "serotonina",
        ),
        "Creatine Kinase (CK)": (
            "creatine kinase",
            "crean quinasa",
            "ck",
            "ck (crean quinasa)",
            "cpk",
            "creatina quinasa",
        ),
        "LDH": (
            "ldh",
            "lactato deshidrogenasa",
            "lactate dehydrogenase",
        ),
        "CEA (Carcinoembryonic Antigen)": (
            "cea",
            "antigeno carcinoembrionario",
            "antígeno carcinoembrionario",
            "carcinoembryonic antigen",
        ),
        "CA 19-9": (
            "ca 19-9",
            "ca-19-9",
            "carbohidrato 19.9",
        ),
        "IgA": (
            "iga",
            "inmunoglobulina  a",
            "inmunoglobulina a",
        ),
        "IgE": (
            "ige",
            "inmunoglobulina  e",
            "inmunoglobulina e",
        ),
        "IgG": (
            "igg",
            "inmunoglobulina  g",
            "inmunoglobulina g",
        ),
        "IgM": (
            "igm",
            "inmunoglobulina  m",
            "inmunoglobulina m",
        ),
        "Alpha-1 Globulin": (
            "alpha-1 globulin",
            "alfa-1 globulina",
            "alfa 1 globulina",
        ),
        "Alpha-2 Globulin": (
            "alpha-2 globulin",
            "alfa-2 globulina",
            "alfa 2 globulina",
        ),
        "Gamma-Globulin": (
            "gamma-globulin",
            "gamma globulin",
            "gamma-globulina",
        ),
        "Urine Specific Gravity": (
            "urine specific gravity",
            "densidad",
            "densidad orina",
            "specific gravity",
        ),
        "Urine pH": (
            "urine ph",
            "ph orina",
            "ph",
        ),
    }

    # Automatically populated inverted lookup cache: alias -> Canonical Name
    BIOMARKER_CANONICAL_NAMES: ClassVar[dict[str, str]] = {}

    CONVERSION_FAMILIES: ClassVar[dict[str, list[str]]] = {
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

    CATEGORY_KEYWORDS: ClassVar[dict[str, tuple[str, ...]]] = {
        "glucose": ("glucose", "glucosa", "blood sugar", "fbs"),
        "triglycerides": ("triglyceride", "triglicérido", "triglicerido"),
        "cholesterol": ("cholesterol", "colesterol", "hdl", "ldl", "vldl"),
        "protein": ("protein", "proteína", "proteina", "albumin", "albúmina"),
        "creatinine": ("creatinine", "creatinina", "crea nina"),
        "bilirubin": ("bilirubin", "bilirrubina"),
        "calcium": ("calcium", "calcio"),
        "bun": ("bun", "blood urea nitrogen"),
        "urea": ("urea",),
        "uric_acid": ("uric", "úrico", "urico"),
        "vitamin_d": ("vitamin d", "vitamina d", "25-oh", "25 oh"),
        "hemoglobin": ("hemoglobin", "hemoglobina", "hgb", "hb"),
    }

    @staticmethod
    def _strip_accents(text: str) -> str:
        """Strip diacritic accents from text for resilient matching."""
        if not text:
            return ""
        nfkd = unicodedata.normalize("NFKD", text)
        return "".join(c for c in nfkd if not unicodedata.combining(c))

    @classmethod
    def get_aliases_for_biomarker(cls, canonical_name: str) -> tuple[str, ...]:
        """Return all aliases associated with a canonical biomarker."""
        return cls.CANONICAL_BIOMARKER_DEFINITIONS.get(canonical_name, ())

    @classmethod
    def get_alias_map(cls) -> dict[str, str]:
        """Return cached mapping of lowercased alias to canonical name."""
        if not cls.BIOMARKER_CANONICAL_NAMES:
            for canon, aliases in cls.CANONICAL_BIOMARKER_DEFINITIONS.items():
                canon_lower = canon.lower()
                cls.BIOMARKER_CANONICAL_NAMES[canon_lower] = canon
                cls.BIOMARKER_CANONICAL_NAMES[
                    cls._strip_accents(canon_lower)
                ] = canon
                for alias in aliases:
                    alias_lower = alias.lower()
                    cls.BIOMARKER_CANONICAL_NAMES[alias_lower] = canon
                    cls.BIOMARKER_CANONICAL_NAMES[
                        cls._strip_accents(alias_lower)
                    ] = canon
        return cls.BIOMARKER_CANONICAL_NAMES

    @classmethod
    def normalize_unit(cls, unit: str | None) -> str:
        """Normalize unit to standard canonical representation."""
        if not unit:
            return ""
        clean = unit.strip().lower()
        clean = re.sub(r"\s+", " ", clean)
        return cls.UNIT_NORMALIZATION.get(clean, unit.strip())

    @classmethod
    def canonical_biomarker_name(cls, raw_name: str) -> str:
        """Find standardized canonical name for a given raw biomarker label."""
        if not raw_name:
            return ""
        alias_map = cls.get_alias_map()
        clean_raw = raw_name.strip().lower()
        stripped_acc = cls._strip_accents(clean_raw)

        # 1. Direct or unaccented exact match
        candidate = alias_map.get(clean_raw) or alias_map.get(stripped_acc)
        if candidate:
            return candidate

        # 2. Punctuation, parenthesis, and noise word removal
        no_punct = re.sub(r"[\*:\'\"`]", " ", stripped_acc)
        clean = re.sub(r"[\(\)\[\]]", " ", no_punct)
        noise_pat = (
            r"\b(suero|plasma|en suero|calculado|basal|por hplc|por elisa|"
            r"formula de friedewald|suero/plasma)\b"
        )
        stripped = re.sub(noise_pat, " ", clean)
        stripped = re.sub(r"\s+", " ", stripped).strip()
        candidate = alias_map.get(clean.strip()) or alias_map.get(stripped)
        if candidate:
            return candidate

        # 3. Substring matching for distinctive aliases
        for alias, canon in alias_map.items():
            if (
                len(alias) >= cls.MIN_ALIAS_LEN_FOR_SUBSTRING
                and f" {alias} " in f" {stripped} "
            ):
                return canon

        return raw_name.strip()

    @classmethod
    def get_category_key(cls, biomarker_name: str) -> str | None:
        """Return the category key for unit conversion families."""
        name_lower = biomarker_name.lower()
        for cat, keywords in cls.CATEGORY_KEYWORDS.items():
            if any(k in name_lower for k in keywords):
                return cat
        return None

    @classmethod
    def get_available_units(
        cls, biomarker_name: str, current_unit: str | None = None
    ) -> list[str]:
        """Return all supported units for a given biomarker."""
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
    def _convert_by_factors(
        cls, cat: str | None, val: float, f_u: str, t_u: str
    ) -> float | None:
        """Helper to compute specific analyte conversion."""
        f_trig_m = 88.57
        dispatch = {
            ("glucose", "mg/dL", "mmol/L"): lambda v: round(v / 18.0182, 2),
            ("glucose", "mmol/L", "mg/dL"): lambda v: round(v * 18.0182, 1),
            ("cholesterol", "mg/dL", "mmol/L"): lambda v: round(v / 38.67, 2),
            ("cholesterol", "mmol/L", "mg/dL"): lambda v: round(v * 38.67, 1),
            ("triglycerides", "mg/dL", "mmol/L"): lambda v: round(
                v / f_trig_m, 2
            ),
            ("triglycerides", "mmol/L", "mg/dL"): lambda v: round(
                v * f_trig_m, 1
            ),
            ("protein", "g/dL", "g/L"): lambda v: round(v * 10.0, 1),
            ("protein", "g/L", "g/dL"): lambda v: round(v / 10.0, 2),
            ("creatinine", "mg/dL", "µmol/L"): lambda v: round(v * 88.4, 1),
            ("creatinine", "µmol/L", "mg/dL"): lambda v: round(v / 88.4, 2),
            ("bilirubin", "mg/dL", "µmol/L"): lambda v: round(v * 17.1, 1),
            ("bilirubin", "µmol/L", "mg/dL"): lambda v: round(v / 17.1, 2),
            ("calcium", "mg/dL", "mmol/L"): lambda v: round(v / 4.008, 2),
            ("calcium", "mmol/L", "mg/dL"): lambda v: round(v * 4.008, 2),
            ("bun", "mg/dL", "mmol/L"): lambda v: round(v / 2.8, 2),
            ("bun", "mmol/L", "mg/dL"): lambda v: round(v * 2.8, 1),
            ("urea", "mg/dL", "mmol/L"): lambda v: round(v / 6.0, 2),
            ("urea", "mmol/L", "mg/dL"): lambda v: round(v * 6.0, 1),
            ("uric_acid", "mg/dL", "µmol/L"): lambda v: round(v * 59.48, 1),
            ("uric_acid", "µmol/L", "mg/dL"): lambda v: round(v / 59.48, 2),
            ("vitamin_d", "ng/mL", "nmol/L"): lambda v: round(v * 2.496, 1),
            ("vitamin_d", "nmol/L", "ng/mL"): lambda v: round(v / 2.496, 1),
            ("hemoglobin", "g/dL", "g/L"): lambda v: round(v * 10.0, 1),
            ("hemoglobin", "g/L", "g/dL"): lambda v: round(v / 10.0, 2),
            ("hemoglobin", "g/dL", "mmol/L"): lambda v: round(v / 1.611, 2),
            ("hemoglobin", "mmol/L", "g/dL"): lambda v: round(v * 1.611, 2),
            ("hemoglobin", "g/L", "mmol/L"): lambda v: round(
                (v / 10.0) / 1.611, 2
            ),
            ("hemoglobin", "mmol/L", "g/L"): lambda v: round(
                (v * 1.611) * 10.0, 1
            ),
        }
        fn = dispatch.get((cat or "", f_u, t_u))
        return fn(val) if fn else None

    @classmethod
    def convert_value(
        cls,
        biomarker_name: str,
        value: float | None,
        from_unit: str,
        to_unit: str,
    ) -> float | None:
        """Convert a scalar measurement between known medical unit systems."""
        if value is None:
            return None

        norm_from = cls.normalize_unit(from_unit)
        norm_to = cls.normalize_unit(to_unit)

        if norm_from == norm_to or not norm_from or not norm_to:
            return round(value, 4)

        cat = cls.get_category_key(biomarker_name)
        converted = cls._convert_by_factors(cat, value, norm_from, norm_to)
        if converted is not None:
            return converted

        # Direct 10x decimal factor conversion if recognized
        pairs_10x_mul = {("g/dL", "g/L"), ("mg/dL", "mg/L")}
        pairs_10x_div = {("g/L", "g/dL"), ("mg/L", "mg/dL")}
        if (norm_from, norm_to) in pairs_10x_mul:
            return round(value * 10.0, 2)
        if (norm_from, norm_to) in pairs_10x_div:
            return round(value / 10.0, 2)

        return round(value, 4)

    @classmethod
    def convert_datapoint(
        cls,
        biomarker_name: str,
        value: float,
        from_unit: str,
        to_unit: str,
        **kwargs: float | None,
    ) -> tuple[float, float | None, float | None, str]:
        """Convert value, ref_min, and ref_max to target unit."""
        norm_to = cls.normalize_unit(to_unit)
        c_val = cls.convert_value(biomarker_name, value, from_unit, norm_to)
        ref_min = kwargs.get("ref_min")
        ref_max = kwargs.get("ref_max")
        c_min = (
            cls.convert_value(biomarker_name, ref_min, from_unit, norm_to)
            if ref_min is not None
            else None
        )
        c_max = (
            cls.convert_value(biomarker_name, ref_max, from_unit, norm_to)
            if ref_max is not None
            else None
        )
        return (c_val if c_val is not None else value, c_min, c_max, norm_to)


unit_converter = UnitConverter()
