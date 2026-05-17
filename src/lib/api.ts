import type { AppState, CsvImportResult } from '../types';

export interface CaseSummary {
  id: string;
  title: string;
  primaryMemberName: string;
  memberCount: number;
  policyCount: number;
  updatedAt: string | null;
}

export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];

  constructor(status: number, errors?: { field: string; message: string }[]) {
    super(`API Error: ${status}`);
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new ApiError(res.status, body.errors), body);
  }
  return res.json();
}

function qs(caseId: string): string {
  return `?caseId=${encodeURIComponent(caseId)}`;
}

export function fetchCases(): Promise<CaseSummary[]> {
  return request<CaseSummary[]>('/api/cases');
}

export function createCase(): Promise<CaseSummary> {
  return request<CaseSummary>('/api/cases', { method: 'POST' });
}

export function deleteCase(id: string): Promise<{ ok: boolean }> {
  return request(`/api/cases/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function fetchAppState(caseId: string): Promise<AppState> {
  return request<AppState>(`/api/app-state${qs(caseId)}`);
}

export function saveAppState(caseId: string, state: AppState): Promise<AppState> {
  return request<AppState>(`/api/app-state${qs(caseId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
}

export function resetAppState(caseId: string): Promise<AppState> {
  return request<AppState>(`/api/app-state/reset${qs(caseId)}`, { method: 'POST' });
}

export function clearAppState(caseId: string): Promise<AppState> {
  return request<AppState>(`/api/app-state/clear${qs(caseId)}`, { method: 'POST' });
}

export function getExportUrl(caseId: string): string {
  return `/api/app-state/export${qs(caseId)}`;
}

export async function importCsv(
  caseId: string,
  file: File,
  overwriteDuplicates = false,
): Promise<CsvImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('caseId', caseId);
  if (overwriteDuplicates) {
    form.append('overwriteDuplicates', 'true');
  }

  const res = await fetch('/api/policies/import-csv', {
    method: 'POST',
    body: form,
  });

  const body = await res.json();
  return body as CsvImportResult;
}

export function checkHealth(): Promise<{ status: string; database: string }> {
  return request('/api/health');
}
