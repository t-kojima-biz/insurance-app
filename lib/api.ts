import type { AppState, AgencyMaster, CsvImportResult } from '@/types';

export interface CaseSummary {
  id: string;
  title: string;
  primaryMemberName: string;
  primaryMemberNameKana: string;
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

export function fetchAgencyMasters(): Promise<AgencyMaster[]> {
  return request<AgencyMaster[]>('/api/agency-masters');
}

export function createAgencyMaster(data: Omit<AgencyMaster, 'id'>): Promise<AgencyMaster> {
  return request<AgencyMaster>('/api/agency-masters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateAgencyMaster(id: string, data: Omit<AgencyMaster, 'id'>): Promise<AgencyMaster> {
  return request<AgencyMaster>(`/api/agency-masters/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteAgencyMaster(id: string): Promise<{ ok: boolean }> {
  return request(`/api/agency-masters/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface InsuranceTypeDescription {
  policyType: string;
  longDescription: string;
  purpose: string;
}

export function fetchInsuranceTypeDescriptions(): Promise<InsuranceTypeDescription[]> {
  return request<InsuranceTypeDescription[]>('/api/insurance-type-descriptions');
}

export function updateInsuranceTypeDescription(
  policyType: string,
  longDescription: string,
  purpose: string,
): Promise<InsuranceTypeDescription> {
  return request<InsuranceTypeDescription>('/api/insurance-type-descriptions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policyType, longDescription, purpose }),
  });
}

export interface PortfolioInsightData {
  id?: string;
  type: 'gap' | 'redundancy' | 'recommendation';
  text: string;
  isCustom: boolean;
}

export function fetchPortfolioInsights(caseId: string): Promise<{ insights: PortfolioInsightData[]; hasData: boolean }> {
  return request(`/api/portfolio-insights${qs(caseId)}`);
}

export function savePortfolioInsights(caseId: string, insights: Omit<PortfolioInsightData, 'id'>[]): Promise<{ insights: PortfolioInsightData[] }> {
  return request(`/api/portfolio-insights${qs(caseId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ insights }),
  });
}

export function resetPortfolioInsights(caseId: string): Promise<{ ok: boolean }> {
  return request(`/api/portfolio-insights${qs(caseId)}`, { method: 'DELETE' });
}

export function getBackupUrl(): string {
  return '/api/backup';
}

export async function restoreBackup(file: File): Promise<{ ok: boolean; message: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/backup', { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.errors);
  return body;
}
