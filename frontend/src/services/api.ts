import { Platform } from 'react-native';
import {
  BiomarkerHistoryResponse,
  LabDocumentResponse,
  LabDocumentSummary,
} from '../types';

export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000/api/v1`;
  }
  // Android emulator uses 10.0.2.2, iOS simulator uses localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://localhost:8000/api/v1';
};

const BASE_URL = getApiBaseUrl();

export interface UploadFileParam {
  uri?: string;
  name: string;
  type: string;
  file?: File | Blob;
}

export const uploadLabDocument = async (
  fileParam: UploadFileParam,
  reUpload: boolean = false
): Promise<LabDocumentResponse> => {
  const url = `${BASE_URL}/labs/upload?re_upload=${reUpload}`;
  const formData = new FormData();

  if (Platform.OS === 'web' && fileParam.file) {
    formData.append('file', fileParam.file, fileParam.name);
  } else if (fileParam.file && typeof File !== 'undefined' && fileParam.file instanceof File) {
    formData.append('file', fileParam.file);
  } else {
    // React Native Mobile FormData
    formData.append('file', {
      uri: fileParam.uri,
      name: fileParam.name,
      type: fileParam.type,
    } as any);
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let detail = 'Upload failed';
    try {
      const errJson = JSON.parse(errorText);
      detail = errJson.detail || detail;
    } catch {
      detail = errorText || detail;
    }
    throw new Error(detail);
  }

  return response.json();
};

export const listLabDocuments = async (): Promise<LabDocumentSummary[]> => {
  const res = await fetch(`${BASE_URL}/labs`);
  if (!res.ok) throw new Error('Failed to load lab documents');
  return res.json();
};

export const getLabDocument = async (id: number): Promise<LabDocumentResponse> => {
  const res = await fetch(`${BASE_URL}/labs/${id}`);
  if (!res.ok) throw new Error('Failed to fetch lab document details');
  return res.json();
};

export const updateLabDate = async (
  id: number,
  testDate: string
): Promise<LabDocumentResponse> => {
  const res = await fetch(`${BASE_URL}/labs/${id}/date`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test_date: testDate }),
  });
  if (!res.ok) throw new Error('Failed to update lab date');
  return res.json();
};

export const deleteLabDocument = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE_URL}/labs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete lab document');
};

export const getLabFileUrl = (id: number, download: boolean = false): string => {
  return `${BASE_URL}/labs/${id}/file?download=${download}`;
};

export const listBiomarkers = async (): Promise<string[]> => {
  const res = await fetch(`${BASE_URL}/biomarkers`);
  if (!res.ok) throw new Error('Failed to list biomarkers');
  return res.json();
};

export const getBiomarkerHistory = async (
  name: string,
  targetUnit?: string
): Promise<BiomarkerHistoryResponse> => {
  let url = `${BASE_URL}/biomarkers/history?name=${encodeURIComponent(name)}`;
  if (targetUnit) {
    url += `&target_unit=${encodeURIComponent(targetUnit)}`;
  }
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await responseSafeText(res);
    throw new Error(errorText || `No history found for ${name}`);
  }
  return res.json();
};

const responseSafeText = async (res: Response): Promise<string> => {
  try {
    const data = await res.json();
    return data.detail || '';
  } catch {
    return '';
  }
};

