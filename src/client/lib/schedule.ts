import { ScheduleResponse, FiltersResponse, AppConfig, ScheduleFilters, Favorite, ReceptionLogEntry, PropagationData } from '../../shared/types';

const API_BASE = '/api';

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
}

export async function fetchScheduleNow(filters: ScheduleFilters): Promise<ScheduleResponse> {
  const query = buildQuery(filters as Record<string, string | undefined>);
  const res = await fetch(`${API_BASE}/schedule/now${query}`);
  if (!res.ok) throw new Error(`Failed to fetch schedule: ${res.status}`);
  return res.json();
}

export async function fetchScheduleUpcoming(hours: number, filters: ScheduleFilters): Promise<ScheduleResponse> {
  const query = buildQuery({ hours: String(hours), ...filters } as Record<string, string | undefined>);
  const res = await fetch(`${API_BASE}/schedule/upcoming${query}`);
  if (!res.ok) throw new Error(`Failed to fetch upcoming: ${res.status}`);
  return res.json();
}

export async function fetchScheduleSearch(q: string): Promise<ScheduleResponse> {
  const res = await fetch(`${API_BASE}/schedule/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Failed to search: ${res.status}`);
  return res.json();
}

export async function refreshSchedule(): Promise<{ status: string; records_parsed: number }> {
  const res = await fetch(`${API_BASE}/schedule/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to refresh: ${res.status}`);
  return res.json();
}

export interface ScheduleStatus {
  broadcast_count: number;
  loaded_at: string | null;
  refresh_interval_hours: number;
  source: string;
}

export async function fetchScheduleStatus(): Promise<ScheduleStatus> {
  const res = await fetch(`${API_BASE}/schedule/status`);
  if (!res.ok) throw new Error(`Failed to fetch schedule status: ${res.status}`);
  return res.json();
}

export async function fetchFilters(): Promise<FiltersResponse> {
  const res = await fetch(`${API_BASE}/filters`);
  if (!res.ok) throw new Error(`Failed to fetch filters: ${res.status}`);
  return res.json();
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`);
  return res.json();
}

export async function updateConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to update config: ${res.status}`);
  return res.json();
}

// Favorites API

export async function fetchFavorites(): Promise<Favorite[]> {
  const res = await fetch(`${API_BASE}/favorites`);
  if (!res.ok) throw new Error(`Failed to fetch favorites: ${res.status}`);
  return res.json();
}

export async function addFavoriteApi(data: Omit<Favorite, 'id' | 'added_at'>): Promise<Favorite> {
  const res = await fetch(`${API_BASE}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to add favorite: ${res.status}`);
  return res.json();
}

export async function removeFavoriteApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/favorites/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to remove favorite: ${res.status}`);
}

// Reception Log API

export async function fetchLog(): Promise<ReceptionLogEntry[]> {
  const res = await fetch(`${API_BASE}/log`);
  if (!res.ok) throw new Error(`Failed to fetch log: ${res.status}`);
  return res.json();
}

export async function addLogEntryApi(data: Omit<ReceptionLogEntry, 'id' | 'logged_at'>): Promise<ReceptionLogEntry> {
  const res = await fetch(`${API_BASE}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to add log entry: ${res.status}`);
  return res.json();
}

export async function removeLogEntryApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/log/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to remove log entry: ${res.status}`);
}

export async function exportLogCsv(): Promise<string> {
  const res = await fetch(`${API_BASE}/log/export`);
  if (!res.ok) throw new Error(`Failed to export log: ${res.status}`);
  return res.text();
}

// Propagation API

export async function fetchPropagationApi(): Promise<PropagationData> {
  const res = await fetch(`${API_BASE}/propagation`);
  if (!res.ok) throw new Error(`Failed to fetch propagation: ${res.status}`);
  return res.json();
}
