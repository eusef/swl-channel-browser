import { Broadcast, ScheduleResponse, FiltersResponse, AppConfig, ScheduleFilters, Favorite, ReceptionLogEntry, PropagationData, StationList } from '../../shared/types';

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

export interface NearbyResponse {
  count: number;
  center_khz: number;
  span_khz: number;
  broadcasts: Broadcast[];
}

export async function fetchNearbyBroadcasts(freqKhz: number, spanKhz: number = 1000): Promise<NearbyResponse> {
  const res = await fetch(`${API_BASE}/schedule/nearby?freq_khz=${freqKhz}&span_khz=${spanKhz}`);
  if (!res.ok) throw new Error(`Failed to fetch nearby: ${res.status}`);
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

// Station Lists API

export async function fetchLists(): Promise<StationList[]> {
  const res = await fetch(`${API_BASE}/lists`);
  if (!res.ok) throw new Error(`Failed to fetch lists: ${res.status}`);
  return res.json();
}

export async function createListApi(name: string): Promise<StationList> {
  const res = await fetch(`${API_BASE}/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create list: ${res.status}`);
  return res.json();
}

export async function renameListApi(id: string, name: string): Promise<StationList> {
  const res = await fetch(`${API_BASE}/lists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to rename list: ${res.status}`);
  return res.json();
}

export async function deleteListApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/lists/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete list: ${res.status}`);
}

export async function addStationApi(listId: string, data: Omit<Favorite, 'id' | 'added_at'>): Promise<Favorite> {
  const res = await fetch(`${API_BASE}/lists/${listId}/stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to add station: ${res.status}`);
  return res.json();
}

export async function removeStationApi(listId: string, stationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/lists/${listId}/stations/${stationId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to remove station: ${res.status}`);
}

export async function moveStationApi(fromListId: string, stationId: string, targetListId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/lists/${fromListId}/stations/${stationId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetListId }),
  });
  if (!res.ok) throw new Error(`Failed to move station: ${res.status}`);
}

export async function exportListApi(listId: string): Promise<{ name: string; stations: Favorite[] }> {
  const res = await fetch(`${API_BASE}/lists/${listId}/export`);
  if (!res.ok) throw new Error(`Failed to export list: ${res.status}`);
  return res.json();
}

export async function importListApi(data: { name: string; stations: Omit<Favorite, 'id' | 'added_at'>[] }): Promise<StationList> {
  const res = await fetch(`${API_BASE}/lists/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to import list: ${res.status}`);
  return res.json();
}

// Propagation API

export async function fetchPropagationApi(): Promise<PropagationData> {
  const res = await fetch(`${API_BASE}/propagation`);
  if (!res.ok) throw new Error(`Failed to fetch propagation: ${res.status}`);
  return res.json();
}
