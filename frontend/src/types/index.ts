export interface BiomarkerResult {
  id?: number | null;
  name: string;
  raw_name?: string | null;
  value: number;
  unit: string;
  ref_min?: number | null;
  ref_max?: number | null;
  reference_range_raw?: string | null;
  flag?: string | null;
  category?: string | null;
}

export interface BiomarkerInput {
  name: string;
  value: number;
  unit: string;
  ref_min?: number | null;
  ref_max?: number | null;
  reference_range_raw?: string | null;
  flag?: string | null;
  category?: string | null;
}

export interface UploadQueueItem {
  id: string;
  file: {
    uri?: string;
    name: string;
    type: string;
    file?: File | Blob;
  };
  status: 'queued' | 'uploading' | 'completed' | 'failed';
  error?: string;
  result?: LabDocumentResponse;
}

export interface LabDocumentResponse {
  id: number;
  filename: string;
  file_hash: string;
  file_size: number;
  mime_type: string;
  test_date?: string | null;
  requires_manual_date: boolean;
  confidence_score: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  biomarkers: BiomarkerResult[];
}

export interface LabDocumentSummary {
  id: number;
  filename: string;
  file_size: number;
  mime_type: string;
  test_date?: string | null;
  requires_manual_date: boolean;
  biomarkers_count: number;
  confidence_score: number;
  created_at: string;
}

export interface BiomarkerHistoryPoint {
  lab_id: number;
  test_date?: string | null;
  filename: string;
  value: number;
  unit: string;
  ref_min?: number | null;
  ref_max?: number | null;
  reference_range_raw?: string | null;
  flag?: string | null;
}

export interface BiomarkerHistoryResponse {
  name: string;
  current_unit: string;
  available_units: string[];
  history: BiomarkerHistoryPoint[];
}

export interface BiomarkerCatalogItem {
  name: string;
  category?: string | null;
  count: number;
  latest_value?: number | null;
  latest_unit?: string | null;
  latest_flag?: string | null;
  latest_date?: string | null;
  available_units: string[];
}

export type SortMode = 'clinical' | 'flagged' | 'alphabetical' | 'custom';


