export interface BiomarkerResult {
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

