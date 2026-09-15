from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class BiomarkerResult(BaseModel):
    id: int | None = Field(default=None, description="Database record ID")
    name: str = Field(
        description="Standardized biomarker name, e.g. 'Triglycerides'"
    )
    raw_name: str | None = Field(
        default=None, description="Original raw name from the lab report"
    )
    value: float = Field(description="Numeric value of the test result")
    unit: str = Field(
        description="Raw unit of measurement, e.g. 'mg/dL', 'mmol/L', 'g/dL'"
    )
    ref_min: float | None = Field(
        default=None, description="Lower normal reference limit if numeric"
    )
    ref_max: float | None = Field(
        default=None, description="Upper normal reference limit if numeric"
    )
    reference_range_raw: str | None = Field(
        default=None,
        description="Raw reference text, e.g. '< 150', '70 - 99'",
    )
    flag: str | None = Field(
        default=None,
        description="Result flag, e.g. 'H' (High), 'L' (Low), or 'Normal'",
    )
    category: str | None = Field(
        default=None,
        description="Panel or category, e.g. 'Lipid Panel', 'Metabolic'",
    )

    model_config = ConfigDict(from_attributes=True)


class BiomarkerCreate(BaseModel):
    name: str = Field(description="Biomarker name, e.g. 'Insulin'")
    value: float = Field(description="Numeric value")
    unit: str = Field(description="Measurement unit, e.g. 'mU/L'")
    ref_min: float | None = Field(
        default=None, description="Lower normal limit"
    )
    ref_max: float | None = Field(
        default=None, description="Upper normal limit"
    )
    reference_range_raw: str | None = Field(
        default=None, description="Raw reference interval"
    )
    flag: str | None = Field(default=None, description="H, L, or Normal")
    category: str | None = Field(default=None, description="Panel category")


class BiomarkerUpdate(BaseModel):
    name: str | None = None
    value: float | None = None
    unit: str | None = None
    ref_min: float | None = None
    ref_max: float | None = None
    reference_range_raw: str | None = None
    flag: str | None = None
    category: str | None = None


class LabExtractionResult(BaseModel):
    test_date: date | None = Field(
        default=None,
        description="Date blood sample was collected or tested (YYYY-MM-DD).",
    )
    requires_manual_date: bool = Field(
        default=False,
        description="True if no valid test date was identifiable.",
    )
    confidence_score: float = Field(
        default=0.95,
        description="Confidence score between 0.0 and 1.0 of extraction.",
    )
    biomarkers: list[BiomarkerResult] = Field(
        default_factory=list,
        description="List of all detected biomarkers in the document",
    )
    notes: str | None = Field(
        default=None, description="Any laboratory or extraction notes"
    )


class LabDocumentResponse(BaseModel):
    id: int
    filename: str
    file_hash: str
    file_size: int
    mime_type: str
    test_date: date | None = None
    requires_manual_date: bool = False
    confidence_score: float = 1.0
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    biomarkers: list[BiomarkerResult] = []

    model_config = ConfigDict(from_attributes=True)


class LabDocumentSummary(BaseModel):
    id: int
    filename: str
    file_size: int
    mime_type: str
    test_date: date | None = None
    requires_manual_date: bool = False
    biomarkers_count: int = 0
    confidence_score: float = 1.0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UpdateDateRequest(BaseModel):
    test_date: date = Field(
        description="Updated test date in YYYY-MM-DD format"
    )


class BiomarkerHistoryPoint(BaseModel):
    lab_id: int
    test_date: date | None = None
    filename: str
    value: float
    unit: str
    ref_min: float | None = None
    ref_max: float | None = None
    reference_range_raw: str | None = None
    flag: str | None = None


class BiomarkerHistoryResponse(BaseModel):
    name: str
    current_unit: str
    available_units: list[str]
    history: list[BiomarkerHistoryPoint]


class UnitConversionDefinition(BaseModel):
    biomarker: str
    from_unit: str
    to_unit: str
    factor: float
    formula_desc: str


class BiomarkerCatalogItem(BaseModel):
    name: str = Field(description="Canonical biomarker name")
    category: str | None = Field(
        default=None, description="Clinical category or panel"
    )
    count: int = Field(default=0, description="Total recorded test values")
    latest_value: float | None = Field(
        default=None, description="Most recent recorded value"
    )
    latest_unit: str | None = Field(
        default=None, description="Unit of the latest recorded value"
    )
    latest_flag: str | None = Field(
        default=None, description="Flag of the latest test (Normal, H, L)"
    )
    latest_date: date | None = Field(
        default=None, description="Date of the most recent test"
    )
    available_units: list[str] = Field(
        default_factory=list, description="All convertible units"
    )
