from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.lab import BiomarkerRecord, LabDocument
from app.schemas.lab import BiomarkerHistoryPoint, BiomarkerHistoryResponse
from app.services.unit_converter import unit_converter

router = APIRouter(prefix="/biomarkers", tags=["Biomarkers"])


@router.get("", response_model=List[str], summary="List all distinct biomarker names for autocomplete")
async def list_biomarkers(db: AsyncSession = Depends(get_db)):
    stmt = select(distinct(BiomarkerRecord.name)).order_by(BiomarkerRecord.name)
    result = await db.execute(stmt)
    names = result.scalars().all()
    return list(names)


@router.get("/history", response_model=BiomarkerHistoryResponse, summary="Get chronological history for a biomarker")
async def get_biomarker_history(
    name: str = Query(..., description="Biomarker name to retrieve history for (e.g. 'Triglycerides')"),
    target_unit: Optional[str] = Query(None, description="Target unit to normalize/convert all values to"),
    db: AsyncSession = Depends(get_db),
):
    canonical_name = unit_converter.canonical_biomarker_name(name)

    # Query matching records (exact canonical name or case-insensitive search)
    stmt = (
        select(BiomarkerRecord, LabDocument)
        .join(LabDocument, BiomarkerRecord.lab_id == LabDocument.id)
        .where(
            func.lower(BiomarkerRecord.name) == canonical_name.lower()
        )
        .order_by(
            asc(func.coalesce(LabDocument.test_date, func.date(LabDocument.created_at))),
            asc(LabDocument.id),
        )
    )
    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        # Check if there are partial matches
        partial_stmt = (
            select(BiomarkerRecord, LabDocument)
            .join(LabDocument, BiomarkerRecord.lab_id == LabDocument.id)
            .where(BiomarkerRecord.name.ilike(f"%{name}%"))
            .order_by(
                asc(func.coalesce(LabDocument.test_date, func.date(LabDocument.created_at))),
                asc(LabDocument.id),
            )
        )
        partial_res = await db.execute(partial_stmt)
        rows = partial_res.all()

    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No biomarker history found for '{name}'."
        )

    # Determine native unit from most recent record
    sample_marker, sample_doc = rows[-1]
    primary_unit = sample_marker.unit
    display_name = sample_marker.name

    available_units = unit_converter.get_available_units(display_name, primary_unit)
    active_unit = unit_converter.normalize_unit(target_unit) if target_unit else primary_unit

    history_points: List[BiomarkerHistoryPoint] = []

    for marker, doc in rows:
        val = marker.value
        r_min = marker.ref_min
        r_max = marker.ref_max
        curr_unit = marker.unit

        # Perform conversion if target unit differs from record unit
        if active_unit and curr_unit != active_unit:
            val, r_min, r_max, curr_unit = unit_converter.convert_datapoint(
                display_name, val, r_min, r_max, curr_unit, active_unit
            )

        history_points.append(
            BiomarkerHistoryPoint(
                lab_id=doc.id,
                test_date=doc.test_date,
                filename=doc.filename,
                value=val,
                unit=curr_unit,
                ref_min=r_min,
                ref_max=r_max,
                reference_range_raw=marker.reference_range_raw,
                flag=marker.flag,
            )
        )

    return BiomarkerHistoryResponse(
        name=display_name,
        current_unit=active_unit,
        available_units=available_units,
        history=history_points,
    )

