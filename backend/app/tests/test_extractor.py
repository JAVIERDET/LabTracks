from datetime import date
from pathlib import Path
from app.services.local_parser import local_lab_parser

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


def test_parse_sample_pdf_with_date():
    pdf_path = FIXTURES_DIR / "sample_quest_lab.pdf"
    content = pdf_path.read_bytes()

    result = local_lab_parser.parse_document(content, "sample_quest_lab.pdf")

    assert result.test_date == date(2024, 3, 15)
    assert result.requires_manual_date is False
    assert len(result.biomarkers) >= 6

    # Verify extracted markers
    marker_map = {b.name: b for b in result.biomarkers}
    assert "Glucose" in marker_map
    assert marker_map["Glucose"].value == 94.0
    assert marker_map["Glucose"].unit == "mg/dL"
    assert marker_map["Glucose"].ref_min == 70.0
    assert marker_map["Glucose"].ref_max == 99.0

    assert "Triglycerides" in marker_map
    assert marker_map["Triglycerides"].value == 165.0
    assert marker_map["Triglycerides"].ref_max == 150.0
    assert marker_map["Triglycerides"].flag == "H"


def test_parse_sample_pdf_missing_date():
    pdf_path = FIXTURES_DIR / "sample_no_date_lab.pdf"
    content = pdf_path.read_bytes()

    result = local_lab_parser.parse_document(content, "sample_no_date_lab.pdf")

    assert result.test_date is None
    assert result.requires_manual_date is True
    assert len(result.biomarkers) > 0

