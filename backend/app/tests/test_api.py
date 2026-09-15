from datetime import date
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"

# In-memory test engine for isolated API testing
test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
async_test_session_maker = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with async_test_session_maker() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
async def setup_test_database():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_upload_and_duplicate_prevention_flow():
    pdf_path = FIXTURES_DIR / "sample_quest_lab.pdf"
    pdf_bytes = pdf_path.read_bytes()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Initial Upload
        files = {"file": ("sample_quest_lab.pdf", pdf_bytes, "application/pdf")}
        res1 = await client.post("/api/v1/labs/upload", files=files)
        assert res1.status_code == 200
        data1 = res1.json()
        doc_id = data1["id"]
        assert data1["filename"] == "sample_quest_lab.pdf"
        assert len(data1["biomarkers"]) > 0
        assert data1["requires_manual_date"] is False
        assert data1["test_date"] == "2024-03-15"

        # 2. Duplicate upload with re_upload=False
        # Must return the existing record without error or re-extraction
        files_dup = {
            "file": ("sample_quest_lab.pdf", pdf_bytes, "application/pdf")
        }
        res2 = await client.post("/api/v1/labs/upload?re_upload=false", files=files_dup)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["id"] == doc_id
        assert data2["filename"] == "sample_quest_lab.pdf"

        # 3. Duplicate upload with re_upload=True
        # Re-triggers extraction and updates document
        files_rescan = {
            "file": ("sample_quest_lab.pdf", pdf_bytes, "application/pdf")
        }
        res3 = await client.post(
            "/api/v1/labs/upload?re_upload=true", files=files_rescan
        )
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["id"] == doc_id

        # 4. List documents
        res_list = await client.get("/api/v1/labs")
        assert res_list.status_code == 200
        docs = res_list.json()
        assert len(docs) == 1
        assert docs[0]["filename"] == "sample_quest_lab.pdf"

        # 5. Stream file
        res_file = await client.get(f"/api/v1/labs/{doc_id}/file")
        assert res_file.status_code == 200
        assert res_file.headers["content-type"] == "application/pdf"
        assert len(res_file.content) > 0


@pytest.mark.asyncio
async def test_manual_date_flow():
    pdf_path = FIXTURES_DIR / "sample_no_date_lab.pdf"
    pdf_bytes = pdf_path.read_bytes()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Upload lab without date
        files = {"file": ("sample_no_date_lab.pdf", pdf_bytes, "application/pdf")}
        res = await client.post("/api/v1/labs/upload", files=files)
        assert res.status_code == 200
        data = res.json()
        assert data["requires_manual_date"] is True
        assert data["test_date"] is None
        doc_id = data["id"]

        # Prompt user for manual date -> PATCH /api/v1/labs/{id}/date
        patch_res = await client.patch(
            f"/api/v1/labs/{doc_id}/date", json={"test_date": "2024-04-18"}
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["test_date"] == "2024-04-18"
        assert updated["requires_manual_date"] is False


@pytest.mark.asyncio
async def test_biomarker_autocomplete_and_history():
    pdf_path = FIXTURES_DIR / "sample_quest_lab.pdf"
    pdf_bytes = pdf_path.read_bytes()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await client.post(
            "/api/v1/labs/upload",
            files={"file": ("sample_quest_lab.pdf", pdf_bytes, "application/pdf")},
        )

        # Autocomplete list
        res_markers = await client.get("/api/v1/biomarkers")
        assert res_markers.status_code == 200
        markers = res_markers.json()
        assert "Triglycerides" in markers
        assert "Glucose" in markers

        # History in native unit (mg/dL)
        res_hist = await client.get("/api/v1/biomarkers/history?name=Triglycerides")
        assert res_hist.status_code == 200
        hist_data = res_hist.json()
        assert hist_data["name"] == "Triglycerides"
        assert hist_data["current_unit"] == "mg/dL"
        assert "mmol/L" in hist_data["available_units"]
        assert len(hist_data["history"]) == 1
        assert hist_data["history"][0]["value"] == 165.0
        assert hist_data["history"][0]["ref_max"] == 150.0

        # History converted to target_unit (mmol/L)
        res_converted = await client.get(
            "/api/v1/biomarkers/history?name=Triglycerides&target_unit=mmol/L"
        )
        assert res_converted.status_code == 200
        conv_data = res_converted.json()
        assert conv_data["current_unit"] == "mmol/L"
        # 165 / 88.57 ~= 1.86 mmol/L
        assert pytest.approx(conv_data["history"][0]["value"], 0.05) == 1.86
        # ref_max 150 / 88.57 ~= 1.69 mmol/L
        assert pytest.approx(conv_data["history"][0]["ref_max"], 0.05) == 1.69
