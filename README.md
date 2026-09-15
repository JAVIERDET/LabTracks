# LabTrack: Automated Blood Biomarker Extraction, Standardization & Trend Tracking

LabTrack is a modular, Dockerized, cross-platform application that extracts, stores, standardizes, and graphs biomarker trends from blood test documents (PDF) and images (JPEG, PNG).

- **Backend**: Python 3.12+ with FastAPI, PostgreSQL 16, SQLAlchemy 2.0 (async), dependency management via Astral `uv`, Google Gemini API (`google-genai`), and local fallback parsing.
- **Frontend**: React Native (Expo) with TypeScript, configured to run seamlessly both in the browser (`npx expo start --web`) and on mobile devices (iOS / Android), featuring interactive SVG line charts with shaded reference bands, real-time unit toggle, duplicate prevention, and document archiving.

---

## Key Features

1. **Ingestion & Extraction**:
   - Web drag-and-drop zone and mobile document/photo pickers.
   - Powered by the Google Gemini API with structured outputs adhering to strict Pydantic schemas.
   - Built-in heuristic fallback engine for instant local development and testing without an API key.
2. **Cost & Duplicate Prevention (`re_upload` flag)**:
   - Tracks file names and SHA-256 hashes in the database.
   - If an identical filename exists and `re_upload=False`, the extraction API call is skipped and the cached database record is returned immediately.
   - The frontend prompts: *"This file has already been processed. Re-scan with AI?"* Confirming triggers `re_upload=True`.
3. **Date Verification**:
   - If no valid specimen collection date is detected in the document, it flags `requires_manual_date: true`.
   - The frontend prompts the user to input the collection date before completing the record (`PATCH /api/v1/labs/{id}/date`).
4. **Unit Standardization & Real-Time Unit Toggle**:
   - Bidirectional medical unit conversion:
     - Glucose: `mg/dL` ⟷ `mmol/L` (factor: 18.0182)
     - Total Cholesterol, HDL, LDL: `mg/dL` ⟷ `mmol/L` (factor: 38.67)
     - Triglycerides: `mg/dL` ⟷ `mmol/L` (factor: 88.57)
     - Total Protein & Albumin: `g/dL` ⟷ `g/L` (factor: 10.0)
     - Creatinine: `mg/dL` ⟷ `µmol/L` (factor: 88.4)
     - Bilirubin: `mg/dL` ⟷ `µmol/L` (factor: 17.1)
     - Calcium: `mg/dL` ⟷ `mmol/L` (factor: 4.008)
     - BUN: `mg/dL` ⟷ `mmol/L` (factor: 2.8)
     - Vitamin D (25-OH): `ng/mL` ⟷ `nmol/L` (factor: 2.496)
     - Hemoglobin: `g/dL` ⟷ `g/L` ⟷ `mmol/L`
   - Switching units on the chart view dynamically converts and re-renders both plotted values and normal reference limits in real time.
5. **Interactive Visualization & Healthy Limits**:
   - Autocomplete search bar for biomarker names.
   - Cross-platform SVG line chart with:
     - Shaded normal reference zone (green band between `ref_min` and `ref_max`).
     - Dashed upper and lower reference threshold boundary lines.
     - Support for variable reference intervals from different laboratories plotted per data point.
     - Interactive popover tooltips displaying exact value, unit, flag (`H`/`L`/`Normal`), and source lab report.
6. **Document Archive & Access**:
   - Browse all uploaded lab documents with test dates, biomarker counts, and sizes.
   - In-app preview modal (embedded PDF viewer or zoomable image preview) and direct download link (`GET /api/v1/labs/{id}/file`).

---

## Architecture & Project Structure

```
LabTrack/
├── docker-compose.yml              # PostgreSQL 16 + FastAPI service orchestration
├── .env.example                    # Environment variable template
├── README.md                       # Documentation
├── backend/
│   ├── pyproject.toml              # Dependencies managed strictly with uv
│   ├── uv.lock                     # Lockfile
│   ├── Dockerfile                  # Multi-stage build with ghcr.io/astral-sh/uv
│   ├── uploads/                    # Local volume storage for uploaded documents
│   ├── fixtures/                   # Sample PDFs & images for testing
│   ├── app/
│   │   ├── main.py                 # FastAPI app entrypoint, CORS, lifespan
│   │   ├── core/
│   │   │   ├── config.py           # Settings (DATABASE_URL, GEMINI_API_KEY, etc.)
│   │   │   └── database.py         # SQLAlchemy async engine, sessionmaker, init_db
│   │   ├── models/
│   │   │   └── lab.py              # LabDocument & BiomarkerRecord models
│   │   ├── schemas/
│   │   │   └── lab.py              # Pydantic schemas (BiomarkerResult, etc.)
│   │   ├── services/
│   │   │   ├── storage.py          # LocalStorageService with SHA-256 calculation
│   │   │   ├── unit_converter.py   # Comprehensive medical unit converter
│   │   │   ├── gemini_extractor.py # Gemini API extractor with structured outputs
│   │   │   └── local_parser.py     # Local heuristic fallback parser
│   │   ├── api/
│   │   │   ├── router_labs.py      # /api/v1/labs (upload, list, file, patch date)
│   │   │   └── router_biomarkers.py# /api/v1/biomarkers (list, history, conversion)
│   │   └── tests/
│   │       ├── test_unit_converter.py
│   │       ├── test_extractor.py
│   │       └── test_api.py
└── frontend/
    ├── app.json                    # Expo configuration (web, ios, android)
    ├── package.json                # Dependencies (Expo SDK 52, react-native-web, SVG)
    ├── App.tsx                     # Main navigation & header layout
    └── src/
        ├── types/                  # TypeScript interfaces
        ├── services/
        │   ├── api.ts              # API client for backend
        │   └── unitConverter.ts    # Instant client-side unit toggle logic
        ├── components/
        │   ├── Header.tsx          # Navigation header
        │   ├── Dropzone.tsx        # Drag-and-drop & mobile picker component
        │   ├── DuplicateModal.tsx  # "File already processed. Re-scan?" modal
        │   ├── DateModal.tsx       # Manual test date prompt modal
        │   ├── UnitSelector.tsx    # Live unit toggle pill control
        │   ├── BiomarkerChart.tsx  # Cross-platform SVG line chart with reference bands
        │   └── DocumentPreviewModal.tsx # In-app PDF and image preview
        └── screens/
            ├── UploadScreen.tsx    # Upload flow and extraction summary table
            ├── TrendsScreen.tsx    # Search autocomplete, unit switcher, trend graph
            └── ArchiveScreen.tsx   # Document archive table with preview and download
```

---

## Quickstart Guide

### 1. Start the Backend & Database with Docker Compose

Ensure Docker is running, then in the project root:

```bash
docker compose up -d
```

- **PostgreSQL 16**: Port `5432` (healthy with persistent volume `pgdata`)
- **FastAPI Backend**: Port `8000` (auto-reloading with bind mounts)
- **Interactive Swagger Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: `GET http://localhost:8000/health`

#### Optional: Configure Gemini API Key
Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
```
*Note: If no key is set, the application automatically uses the built-in intelligent fallback parser so all features can be tested locally without an API key.*

---

### 2. Start the Cross-Platform Frontend (Web & Mobile)

In a new terminal:

```bash
cd frontend
npx expo start --web
```

- **Web Browser**: Open [http://localhost:8081](http://localhost:8081)
- **Mobile (iOS / Android)**: Scan the displayed QR code with the Expo Go app.

---

### 3. Run Automated Tests

To run the complete automated test suite (14 passing tests covering unit conversions, document parsing, upload duplicate prevention, date patching, and biomarker history):

```bash
cd backend
uv run pytest
```

---

## API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/labs/upload?re_upload=false` | Upload and extract blood test report. If file exists and `re_upload=false`, skips extraction and returns cached record. |
| `GET` | `/api/v1/labs` | Returns list of all uploaded lab documents and summary metadata. |
| `GET` | `/api/v1/labs/{id}` | Returns full document details including all extracted biomarkers. |
| `GET` | `/api/v1/labs/{id}/file` | Streams or downloads the original uploaded PDF or image. |
| `PATCH` | `/api/v1/labs/{id}/date` | Updates test date when manual date verification is required. |
| `DELETE`| `/api/v1/labs/{id}` | Deletes lab document and underlying stored file. |
| `GET` | `/api/v1/biomarkers` | Returns distinct list of all biomarker names for search autocomplete. |
| `GET` | `/api/v1/biomarkers/history` | Returns chronological history, reference intervals, and convertible units (`?name={marker}&target_unit={unit}`). |

