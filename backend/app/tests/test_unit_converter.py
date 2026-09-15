import pytest
from app.services.unit_converter import unit_converter


def test_unit_normalization():
    assert unit_converter.normalize_unit("mg/dl") == "mg/dL"
    assert unit_converter.normalize_unit("MG/DL") == "mg/dL"
    assert unit_converter.normalize_unit("mmol/l") == "mmol/L"
    assert unit_converter.normalize_unit("umol/l") == "µmol/L"
    assert unit_converter.normalize_unit("g/dl") == "g/dL"
    assert unit_converter.normalize_unit("ng/ml") == "ng/mL"


def test_biomarker_canonical_naming():
    assert unit_converter.canonical_biomarker_name("glucose") == "Glucose"
    assert unit_converter.canonical_biomarker_name("fasting blood sugar") == "Glucose"
    assert unit_converter.canonical_biomarker_name("triglycerides") == "Triglycerides"
    assert unit_converter.canonical_biomarker_name("hdl-c") == "HDL Cholesterol"
    assert unit_converter.canonical_biomarker_name("ldl (calculated)") == "LDL Cholesterol"
    assert unit_converter.canonical_biomarker_name("cholesterol, total") == "Total Cholesterol"


def test_glucose_conversion():
    # 90 mg/dL -> mmol/L: 90 / 18.0182 = 4.99 mmol/L
    mmol = unit_converter.convert_value("Glucose", 90.0, "mg/dL", "mmol/L")
    assert pytest.approx(mmol, 0.05) == 5.0

    # 5.0 mmol/L -> mg/dL: 5.0 * 18.0182 = 90.09 mg/dL
    mgdl = unit_converter.convert_value("Glucose", 5.0, "mmol/L", "mg/dL")
    assert pytest.approx(mgdl, 0.5) == 90.1


def test_cholesterol_conversion():
    # 200 mg/dL -> mmol/L: 200 / 38.67 = 5.17 mmol/L
    mmol = unit_converter.convert_value("Total Cholesterol", 200.0, "mg/dL", "mmol/L")
    assert pytest.approx(mmol, 0.05) == 5.17


def test_triglycerides_conversion():
    # 150 mg/dL -> mmol/L: 150 / 88.57 = 1.69 mmol/L
    mmol = unit_converter.convert_value("Triglycerides", 150.0, "mg/dL", "mmol/L")
    assert pytest.approx(mmol, 0.05) == 1.69


def test_protein_conversion():
    # 7.0 g/dL -> g/L: 7.0 * 10 = 70.0 g/L
    gl = unit_converter.convert_value("Total Protein", 7.0, "g/dL", "g/L")
    assert gl == 70.0


def test_creatinine_conversion():
    # 1.0 mg/dL -> µmol/L: 1.0 * 88.4 = 88.4 µmol/L
    umol = unit_converter.convert_value("Creatinine", 1.0, "mg/dL", "µmol/L")
    assert umol == 88.4


def test_convert_datapoint_with_limits():
    val, r_min, r_max, unit = unit_converter.convert_datapoint(
        "Triglycerides",
        value=150.0,
        ref_min=None,
        ref_max=150.0,
        from_unit="mg/dL",
        to_unit="mmol/L",
    )
    assert unit == "mmol/L"
    assert pytest.approx(val, 0.05) == 1.69
    assert r_min is None
    assert pytest.approx(r_max, 0.05) == 1.69

