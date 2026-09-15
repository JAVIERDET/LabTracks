from datetime import date
from pathlib import Path

from app.services.local_parser import local_lab_parser

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


def test_parse_spanish_lab_14_08_2025():
    pdf_path = FIXTURES_DIR / "14_08_2025.pdf"
    content = pdf_path.read_bytes()

    result = local_lab_parser.parse_document(content, "14_08_2025.pdf")

    assert result.test_date == date(2025, 8, 14)
    assert result.requires_manual_date is False
    assert len(result.biomarkers) >= 20

    marker_map = {b.name: b for b in result.biomarkers}
    assert "Glucose" in marker_map
    assert marker_map["Glucose"].value == 83.0
    assert marker_map["Glucose"].unit == "mg/dL"
    assert marker_map["Glucose"].ref_min == 60.0
    assert marker_map["Glucose"].ref_max == 100.0

    assert "Total Cholesterol" in marker_map
    assert marker_map["Total Cholesterol"].value == 204.0
    assert marker_map["Total Cholesterol"].ref_max == 200.0
    assert marker_map["Total Cholesterol"].flag == "H"

    assert "Triglycerides" in marker_map
    assert marker_map["Triglycerides"].value == 91.0


def test_parse_spanish_lab_09_09_2026():
    pdf_path = FIXTURES_DIR / "09_09_2026.pdf"
    content = pdf_path.read_bytes()

    result = local_lab_parser.parse_document(content, "09_09_2026.pdf")

    assert result.test_date == date(2026, 8, 27)
    assert result.requires_manual_date is False
    assert len(result.biomarkers) >= 15

    marker_map = {b.name: b for b in result.biomarkers}
    assert "Glucose" in marker_map
    assert marker_map["Glucose"].value == 72.0
    assert "Total Cholesterol" in marker_map
    assert marker_map["Total Cholesterol"].value == 288.0
    assert marker_map["Total Cholesterol"].flag == "H"


def test_parse_all_fixtures_smoke():
    pdf_files = [
        "03_11_2025.pdf",
        "09_09_2026.pdf",
        "14_08_2025.pdf",
        "25_11_2024.pdf",
        "27_01_2025.pdf",
        "30_07_2026.PDF",
        "Subfraccionamiento-LDL_27_01_2025.pdf",
    ]
    for fn in pdf_files:
        path = FIXTURES_DIR / fn
        assert path.exists(), f"Fixture {fn} missing"
        result = local_lab_parser.parse_document(path.read_bytes(), fn)
        assert result.test_date is not None, f"No date extracted for {fn}"
        assert result.requires_manual_date is False, (
            f"Manual date required for {fn}"
        )
        assert len(result.biomarkers) > 0, (
            f"Zero biomarkers extracted for {fn}"
        )


def test_parse_dummy_missing_date():
    dummy_text = b"RESULTADOS\nGlucosa 95 mg/dL [ 70 - 100 ]\n"
    result = local_lab_parser.parse_document(dummy_text, "unknown_doc.txt")
    assert result.test_date is None
    assert result.requires_manual_date is True
    assert len(result.biomarkers) == 1
    assert result.biomarkers[0].name == "Glucose"
