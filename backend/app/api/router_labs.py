import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.lab import BiomarkerRecord, LabDocument
from app.schemas.lab import (
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
    response_model=LabDocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload and extract blood test report",
)
async def upload_lab_document(
    file: UploadFile = File(...),
    re_upload: bool = Query(
        False,
        description="If True, re-runs AI extraction even if document with identical filename already exists.",
    ),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_hash = storage_service.calculate_hash(content)
    mime_type = file.content_type or storage_service.guess_mime_type(file.filename, content)

    # Check for existing document by filename
    stmt = (
        select(LabDocument)
        .where(LabDocument.filename == file.filename)
        .options(selectinload(LabDocument.biomarkers))
    )
    result = await db.execute(stmt)
    existing_doc = result.scalar_one_or_none()

    # Cost & Duplicate Prevention:
    # If identical filename exists and re_upload is False, return cached DB record
    if existing_doc and not re_upload:
        logger.info(
            f"File '{file.filename}' already exists (ID: {existing_doc.id}). Skipping AI extraction."
        )
        return existing_doc

    # Persist file
    stored_path, computed_hash, file_size = await storage_service.save_file(content, file.filename)

    # Perform extraction
    extraction = await gemini_extractor.extract_from_file(content, file.filename, mime_type)

    if existing_doc and re_upload:
        logger.info(f"Re-scanning existing document '{file.filename}' (ID: {existing_doc.id})...")
        # Update existing document
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
        return existing_doc

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
    logger.info(f"Successfully created lab document ID {new_doc.id} with {len(new_doc.biomarkers)} biomarkers")
    return new_doc


@router.get("", response_model=List[LabDocumentSummary], summary="List all uploaded lab documents")
async def list_lab_documents(db: AsyncSession = Depends(get_db)):
    stmt = select(LabDocument).options(selectinload(LabDocument.biomarkers)).order_by(desc(LabDocument.created_at))
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


@router.get("/{id}", response_model=LabDocumentResponse, summary="Get full lab document details")
async def get_lab_document(id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(LabDocument).where(LabDocument.id == id).options(selectinload(LabDocument.biomarkers))
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Lab document not found.")
    return doc


@router.get("/{id}/file", summary="Stream or download original lab document file")
async def get_lab_document_file(
    id: int,
    download: bool = Query(False, description="If True, sends Attachment disposition"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LabDocument).where(LabDocument.id == id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Lab document not found.")

    try:
        content = await storage_service.get_file(doc.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Underlying file not found in storage.")

    disposition_type = "attachment" if download else "inline"
    headers = {
        "Content-Disposition": f'{disposition_type}; filename="{doc.filename}"',
        "Content-Length": str(len(content)),
    }
    return Response(content=content, media_type=doc.mime_type, headers=headers)


@router.patch("/{id}/date", response_model=LabDocumentResponse, summary="Update test date")
async def update_lab_document_date(
    id: int,
    payload: UpdateDateRequest,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LabDocument).where(LabDocument.id == id).options(selectinload(LabDocument.biomarkers))
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Lab document not found.")

    doc.test_date = payload.test_date
    doc.requires_manual_date = False
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete lab document")
async def delete_lab_document(id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(LabDocument).where(LabDocument.id == id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Lab document not found.")

    await storage_service.delete_file(doc.file_path)
    await db.delete(doc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

