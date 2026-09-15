import logging
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Path,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.lab import BiomarkerRecord, LabDocument
from app.schemas.lab import (
    BiomarkerCreate,
    BiomarkerResult,
    BiomarkerUpdate,
    LabDocumentResponse,
    LabDocumentSummary,
    UpdateDateRequest,
)
from app.services.gemini_extractor import gemini_extractor
from app.services.storage import storage_service
from app.services.unit_converter import unit_converter

logger = logging.getLogger("labtrack.api.labs")

router = APIRouter(prefix="/labs", tags=["Labs"])


@router.post(
    "/upload",
    status_code=status.HTTP_200_OK,
    summary="Upload and extract blood test report",
)
async def upload_lab_document(
    file: Annotated[UploadFile, File(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    *,
    re_upload: Annotated[
        bool,
        Query(
            description="If True, re-runs AI extraction even if file exists.",
        ),
    ] = False,
) -> LabDocumentResponse:
    if not file.filename:
        msg = "Filename cannot be empty."
        raise HTTPException(status_code=400, detail=msg)

    content = await file.read()
    if not content:
        msg = "Uploaded file is empty."
        raise HTTPException(status_code=400, detail=msg)

    mime_type = file.content_type or storage_service.guess_mime_type(
        file.filename, content
    )

    # Check for existing document by filename
    stmt = (
        select(LabDocument)
        .where(LabDocument.filename == file.filename)
        .options(selectinload(LabDocument.biomarkers))
    )
    result = await db.execute(stmt)
    existing_doc = result.scalar_one_or_none()

    # Cost & Duplicate Prevention:
    # If identical filename exists and re_upload is False, return cached record
    if existing_doc and not re_upload:
        logger.info(
            "File '%s' already exists (ID: %d). Skipping AI extraction.",
            file.filename,
            existing_doc.id,
        )
        return LabDocumentResponse.model_validate(existing_doc)

    # Persist file
    stored_path, computed_hash, file_size = await storage_service.save_file(
        content, file.filename
    )

    # Perform extraction
    extraction = await gemini_extractor.extract_from_file(
        content, file.filename, mime_type
    )

    if existing_doc and re_upload:
        logger.info(
            "Re-scanning existing document '%s' (ID: %d)...",
            file.filename,
            existing_doc.id,
        )
        existing_doc.file_hash = computed_hash
        existing_doc.file_path = stored_path
        existing_doc.file_size = file_size
        existing_doc.mime_type = mime_type
        existing_doc.test_date = extraction.test_date
        existing_doc.requires_manual_date = extraction.requires_manual_date
        existing_doc.confidence_score = extraction.confidence_score
        existing_doc.notes = extraction.notes

        # Replace biomarkers
        existing_doc.biomarkers.clear()
        for b in extraction.biomarkers:
            canonical_name = unit_converter.canonical_biomarker_name(b.name)
            normalized_unit = unit_converter.normalize_unit(b.unit)
            record = BiomarkerRecord(
                name=canonical_name,
                raw_name=b.raw_name or b.name,
                value=b.value,
                unit=normalized_unit,
                ref_min=b.ref_min,
                ref_max=b.ref_max,
                reference_range_raw=b.reference_range_raw,
                flag=b.flag,
                category=b.category,
            )
            existing_doc.biomarkers.append(record)

        await db.commit()
        await db.refresh(existing_doc)
        return LabDocumentResponse.model_validate(existing_doc)

    # Create new document
    new_doc = LabDocument(
        filename=file.filename,
        file_hash=computed_hash,
        file_path=stored_path,
        file_size=file_size,
        mime_type=mime_type,
        test_date=extraction.test_date,
        requires_manual_date=extraction.requires_manual_date,
        confidence_score=extraction.confidence_score,
        notes=extraction.notes,
    )

    for b in extraction.biomarkers:
        canonical_name = unit_converter.canonical_biomarker_name(b.name)
        normalized_unit = unit_converter.normalize_unit(b.unit)
        record = BiomarkerRecord(
            name=canonical_name,
            raw_name=b.raw_name or b.name,
            value=b.value,
            unit=normalized_unit,
            ref_min=b.ref_min,
            ref_max=b.ref_max,
            reference_range_raw=b.reference_range_raw,
            flag=b.flag,
            category=b.category,
        )
        new_doc.biomarkers.append(record)

    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    logger.info(
        "Created lab document ID %d with %d biomarkers",
        new_doc.id,
        len(new_doc.biomarkers),
    )
    return LabDocumentResponse.model_validate(new_doc)


@router.get(
    "",
    summary="List all uploaded lab documents",
)
async def list_lab_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[LabDocumentSummary]:
    stmt = (
        select(LabDocument)
        .options(selectinload(LabDocument.biomarkers))
        .order_by(desc(LabDocument.created_at))
    )
    result = await db.execute(stmt)
    docs = result.scalars().all()

    summaries = []
    for doc in docs:
        summaries.append(
            LabDocumentSummary(
                id=doc.id,
                filename=doc.filename,
                file_size=doc.file_size,
                mime_type=doc.mime_type,
                test_date=doc.test_date,
                requires_manual_date=doc.requires_manual_date,
                biomarkers_count=len(doc.biomarkers),
                confidence_score=doc.confidence_score,
                created_at=doc.created_at,
            )
        )
    return summaries


@router.get(
    "/{doc_id}",
    summary="Get full lab document details",
)
async def get_lab_document(
    doc_id: Annotated[int, Path(alias="doc_id")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LabDocumentResponse:
    stmt = (
        select(LabDocument)
        .where(LabDocument.id == doc_id)
        .options(selectinload(LabDocument.biomarkers))
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        msg = "Lab document not found."
        raise HTTPException(status_code=404, detail=msg)
    return LabDocumentResponse.model_validate(doc)


@router.get(
    "/{doc_id}/file", summary="Stream or download original lab document file"
)
async def get_lab_document_file(
    doc_id: Annotated[int, Path(alias="doc_id")],
    db: Annotated[AsyncSession, Depends(get_db)],
    *,
    download: Annotated[
        bool, Query(description="If True, sends Attachment disposition")
    ] = False,
) -> Response:
    stmt = select(LabDocument).where(LabDocument.id == doc_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        msg = "Lab document not found."
        raise HTTPException(status_code=404, detail=msg)

    try:
        content = await storage_service.get_file(doc.file_path)
    except FileNotFoundError as err:
        msg = "Underlying file not found in storage."
        raise HTTPException(status_code=404, detail=msg) from err

    disposition_type = "attachment" if download else "inline"
    disp_val = f'{disposition_type}; filename="{doc.filename}"'
    headers = {
        "Content-Disposition": disp_val,
        "Content-Length": str(len(content)),
    }
    return Response(content=content, media_type=doc.mime_type, headers=headers)


@router.patch(
    "/{doc_id}/date",
    summary="Update test date",
)
async def update_lab_document_date(
    doc_id: Annotated[int, Path(alias="doc_id")],
    payload: UpdateDateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LabDocumentResponse:
    stmt = (
        select(LabDocument)
        .where(LabDocument.id == doc_id)
        .options(selectinload(LabDocument.biomarkers))
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        msg = "Lab document not found."
        raise HTTPException(status_code=404, detail=msg)

    doc.test_date = payload.test_date
    doc.requires_manual_date = False
    await db.commit()
    await db.refresh(doc)
    return LabDocumentResponse.model_validate(doc)


@router.delete(
    "/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete lab document",
)
async def delete_lab_document(
    doc_id: Annotated[int, Path(alias="doc_id")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    stmt = select(LabDocument).where(LabDocument.id == doc_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        msg = "Lab document not found."
        raise HTTPException(status_code=404, detail=msg)

    await storage_service.delete_file(doc.file_path)
    await db.delete(doc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _compute_flag(
    value: float,
    ref_min: float | None,
    ref_max: float | None,
    explicit_flag: str | None = None,
) -> str | None:
    if explicit_flag:
        return explicit_flag
    if ref_min is not None and value < ref_min:
        return "L"
    if ref_max is not None and value > ref_max:
        return "H"
    if ref_min is not None or ref_max is not None:
        return "Normal"
    return None


def _apply_biomarker_updates(
    record: BiomarkerRecord,
    payload: BiomarkerUpdate,
) -> None:
    if payload.name is not None:
        record.raw_name = payload.name
        record.name = unit_converter.canonical_biomarker_name(payload.name)
    if payload.value is not None:
        record.value = payload.value
    if payload.unit is not None:
        record.unit = unit_converter.normalize_unit(payload.unit)
    if payload.ref_min is not None:
        record.ref_min = payload.ref_min
    if payload.ref_max is not None:
        record.ref_max = payload.ref_max
    if payload.reference_range_raw is not None:
        record.reference_range_raw = payload.reference_range_raw
    if payload.category is not None:
        record.category = payload.category

    record.flag = _compute_flag(
        record.value,
        record.ref_min,
        record.ref_max,
        payload.flag,
    )


@router.post(
    "/{doc_id}/biomarkers",
    status_code=status.HTTP_201_CREATED,
    summary="Add a new biomarker to an existing lab document",
)
async def add_biomarker_to_lab(
    doc_id: Annotated[int, Path(alias="doc_id")],
    payload: BiomarkerCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BiomarkerResult:
    stmt = select(LabDocument).where(LabDocument.id == doc_id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        msg = "Lab document not found."
        raise HTTPException(status_code=404, detail=msg)

    std_name = unit_converter.canonical_biomarker_name(payload.name)
    normalized_unit = unit_converter.normalize_unit(payload.unit)
    flag = _compute_flag(
        payload.value,
        payload.ref_min,
        payload.ref_max,
        payload.flag,
    )

    record = BiomarkerRecord(
        lab_id=doc.id,
        name=std_name,
        raw_name=payload.name,
        value=payload.value,
        unit=normalized_unit,
        ref_min=payload.ref_min,
        ref_max=payload.ref_max,
        reference_range_raw=payload.reference_range_raw,
        flag=flag,
        category=payload.category or "Other",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return BiomarkerResult.model_validate(record)


@router.put(
    "/{doc_id}/biomarkers/{biomarker_id}",
    summary="Update an existing biomarker in a lab document",
)
async def update_lab_biomarker(
    doc_id: Annotated[int, Path(alias="doc_id")],
    biomarker_id: Annotated[int, Path(alias="biomarker_id")],
    payload: BiomarkerUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BiomarkerResult:
    stmt = select(BiomarkerRecord).where(
        BiomarkerRecord.id == biomarker_id,
        BiomarkerRecord.lab_id == doc_id,
    )
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        msg = "Biomarker record not found."
        raise HTTPException(status_code=404, detail=msg)

    _apply_biomarker_updates(record, payload)
    await db.commit()
    await db.refresh(record)
    return BiomarkerResult.model_validate(record)


@router.delete(
    "/{doc_id}/biomarkers/{biomarker_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a biomarker from a lab document",
)
async def delete_lab_biomarker(
    doc_id: Annotated[int, Path(alias="doc_id")],
    biomarker_id: Annotated[int, Path(alias="biomarker_id")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    stmt = select(BiomarkerRecord).where(
        BiomarkerRecord.id == biomarker_id,
        BiomarkerRecord.lab_id == doc_id,
    )
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        msg = "Biomarker record not found."
        raise HTTPException(status_code=404, detail=msg)

    await db.delete(record)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
