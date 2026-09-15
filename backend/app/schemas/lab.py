from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BiomarkerResult(BaseModel):
    name: str = Field(description="Standardized or common biomarker name, e.g. 'Triglycerides'")
    raw_name: Optional[str] = Field(default=None, description="Original raw name from the lab report")
    value: float = Field(description="Numeric value of the test result")
    unit: str = Field(description="Raw unit of measurement, e.g. 'mg/dL', 'mmol/L', 'g/dL'")
    ref_min: Optional[float] = Field(default=None, description="Lower normal reference limit if numeric")
    ref_max: Optional[float] = Field(default=None, description="Upper normal reference limit if numeric")
    reference_range_raw: Optional[str] = Field(
        default=None, description="Raw text representation of reference range, e.g. '< 150', '70 - 99'"
    )
    flag: Optional[str] = Field(default=None, description="Result flag, e.g. 'H' (High), 'L' (Low), or 'Normal'")
    category: Optional[str] = Field(default=None, description="Panel or category, e.g. 'Lipid Panel', 'Metabolic'")


class LabExtractionResult(BaseModel):
    test_date: Optional[date] = Field(
        default=None,
        description="Date the blood sample was collected/tested (YYYY-MM-DD). If no clear date is detected, set to null.",
    )
    requires_manual_date: bool = Field(
        default=False,
        description="Set to true if no valid test date was identifiable in the document.",
    )
    confidence_score: float = Field(
        default=0.95,
        description="Confidence score between 0.0 and 1.0 of the extraction quality",
    )
    biomarkers: List[BiomarkerResult] = Field(
        default_factory=list,
        description="List of all detected biomarkers in the document",
    )
    notes: Optional[str] = Field(default=None, description="Any laboratory or extraction notes")


class LabDocumentResponse(BaseModel):
    id: int
    filename: str
    file_hash: str
    file_size: int
    mime_type: str
    test_date: Optional[date] = None
    requires_manual_date: bool = False
    confidence_score: float = 1.0
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    biomarkers: List[BiomarkerResult] = []

    model_config = ConfigDict(from_attributes=True)


class LabDocumentSummary(BaseModel):
    id: int
    filename: str
    file_size: int
    mime_type: str
    test_date: Optional[date] = None
    requires_manual_date: bool = False
    biomarkers_count: int = 0
    confidence_score: float = 1.0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UpdateDateRequest(BaseModel):
    test_date: date = Field(description="Updated test date in YYYY-MM-DD format")


class BiomarkerHistoryPoint(BaseModel):
    lab_id: int
    test_date: Optional[date] = None
    filename: str
    value: float
    unit: str
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    reference_range_raw: Optional[str] = None
    flag: Optional[str] = None


class BiomarkerHistoryResponse(BaseModel):
    name: str
    current_unit: str
    available_units: List[str]
    history: List[BiomarkerHistoryPoint]


class UnitConversionDefinition(BaseModel):
    biomarker: str
    from_unit: str
    to_unit: str
    factor: float
    formula_desc: str
