from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.database import Base, get_db
from app.main import app

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine: AsyncEngine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
async def setup_test_database() -> AsyncGenerator[None, None]:
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
    pdf_path = FIXTURES_DIR / "14_08_2025.pdf"
    pdf_bytes = pdf_path.read_bytes()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Initial Upload
        files = {"file": ("14_08_2025.pdf", pdf_bytes, "application/pdf")}
        res1 = await client.post("/api/v1/labs/upload", files=files)
        assert res1.status_code == 200
        data1 = res1.json()
        doc_id = data1["id"]
        assert data1["filename"] == "14_08_2025.pdf"
        assert len(data1["biomarkers"]) >= 20
        assert data1["requires_manual_date"] is False
        assert data1["test_date"] == "2025-08-14"

        # 2. Duplicate upload with re_upload=False
        # Must return the existing record without error or re-extraction
        files_dup = {"file": ("14_08_2025.pdf", pdf_bytes, "application/pdf")}
        res2 = await client.post(
            "/api/v1/labs/upload?re_upload=false", files=files_dup
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["id"] == doc_id
        assert data2["filename"] == "14_08_2025.pdf"

        # 3. Duplicate upload with re_upload=True
        # Re-triggers extraction and updates document
        files_rescan = {
            "file": ("14_08_2025.pdf", pdf_bytes, "application/pdf")
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
        assert docs[0]["filename"] == "14_08_2025.pdf"

        # 5. Stream file
        res_file = await client.get(f"/api/v1/labs/{doc_id}/file")
        assert res_file.status_code == 200
        assert res_file.headers["content-type"] == "application/pdf"
        assert len(res_file.content) > 0


@pytest.mark.asyncio
async def test_manual_date_flow():
    dummy_bytes = b"RESULTADOS\nGlucosa 95 mg/dL [ 70 - 100 ]\n"

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Upload lab without date
        files = {"file": ("test_nodate.txt", dummy_bytes, "text/plain")}
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
    pdf_path = FIXTURES_DIR / "14_08_2025.pdf"
    pdf_bytes = pdf_path.read_bytes()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await client.post(
            "/api/v1/labs/upload",
            files={"file": ("14_08_2025.pdf", pdf_bytes, "application/pdf")},
        )

        # Autocomplete list
        res_markers = await client.get("/api/v1/biomarkers")
        assert res_markers.status_code == 200
        markers = res_markers.json()
        assert "Total Cholesterol" in markers
        assert "Glucose" in markers

        # History in native unit (mg/dL)
        res_hist = await client.get(
            "/api/v1/biomarkers/history?name=Total%20Cholesterol"
        )
        assert res_hist.status_code == 200
        hist_data = res_hist.json()
        assert hist_data["name"] == "Total Cholesterol"
        assert hist_data["current_unit"] == "mg/dL"
        assert "mmol/L" in hist_data["available_units"]
        assert len(hist_data["history"]) == 1
        assert hist_data["history"][0]["value"] == 204.0
        assert hist_data["history"][0]["ref_max"] == 200.0

        # History converted to target_unit (mmol/L)
        res_converted = await client.get(
            "/api/v1/biomarkers/history?name=Total%20Cholesterol&target_unit=mmol/L"
        )
        assert res_converted.status_code == 200
        conv_data = res_converted.json()
        assert conv_data["current_unit"] == "mmol/L"
        # 204 / 38.67 = 5.28
        assert pytest.approx(conv_data["history"][0]["value"], 0.05) == 5.28

        # Biomarker Catalog test
        res_cat = await client.get("/api/v1/biomarkers/catalog")
        assert res_cat.status_code == 200
        cat_items = res_cat.json()
        tc = next(
            (c for c in cat_items if c["name"] == "Total Cholesterol"), None
        )
        assert tc is not None
        assert tc["count"] >= 1
        assert tc["latest_value"] == 204.0
        assert tc["latest_unit"] == "mg/dL"
        assert "mmol/L" in tc["available_units"]


@pytest.mark.asyncio
async def test_biomarker_crud_flow():
    dummy_bytes = b"RESULTADOS\nGlucosa 95 mg/dL [ 70 - 100 ]\n"

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Upload lab
        files = {"file": ("test_crud.txt", dummy_bytes, "text/plain")}
        res = await client.post("/api/v1/labs/upload", files=files)
        assert res.status_code == 200
        doc_id = res.json()["id"]
        initial_count = len(res.json()["biomarkers"])

        # 2. Add new biomarker (e.g. Homocysteine)
        create_payload = {
            "name": "Homocisteina",
            "value": 18.5,
            "unit": "umol/L",
            "ref_min": 5.0,
            "ref_max": 15.0,
            "category": "Cardiovascular",
        }
        add_res = await client.post(
            f"/api/v1/labs/{doc_id}/biomarkers",
            json=create_payload,
        )
        assert add_res.status_code == 201
        new_marker = add_res.json()
        assert new_marker["id"] is not None
        marker_id = new_marker["id"]
        assert new_marker["name"] == "Homocysteine"
        assert new_marker["flag"] == "H"
        assert new_marker["category"] == "Cardiovascular"

        # Verify doc now has initial_count + 1 biomarkers
        doc_res = await client.get(f"/api/v1/labs/{doc_id}")
        assert len(doc_res.json()["biomarkers"]) == initial_count + 1

        # 3. Update biomarker value to normal range
        update_payload = {"value": 10.0}
        put_res = await client.put(
            f"/api/v1/labs/{doc_id}/biomarkers/{marker_id}",
            json=update_payload,
        )
        assert put_res.status_code == 200
        updated_marker = put_res.json()
        assert updated_marker["value"] == 10.0
        assert updated_marker["flag"] == "Normal"

        # 4. Delete biomarker
        del_res = await client.delete(
            f"/api/v1/labs/{doc_id}/biomarkers/{marker_id}"
        )
        assert del_res.status_code == 204

        # 5. Verify deleted
        doc_after_del = await client.get(f"/api/v1/labs/{doc_id}")
        biomarker_ids = [b["id"] for b in doc_after_del.json()["biomarkers"]]
        assert marker_id not in biomarker_ids
