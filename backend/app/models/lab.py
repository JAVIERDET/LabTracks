from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LabDocument(Base):
    __tablename__ = "lab_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    test_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    requires_manual_date: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    biomarkers: Mapped[List["BiomarkerRecord"]] = relationship(
        "BiomarkerRecord",
        back_populates="lab_document",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="BiomarkerRecord.name",
    )


class BiomarkerRecord(Base):
    __tablename__ = "biomarker_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lab_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lab_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    raw_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    ref_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ref_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_range_raw: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    flag: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lab_document: Mapped["LabDocument"] = relationship("LabDocument", back_populates="biomarkers")

