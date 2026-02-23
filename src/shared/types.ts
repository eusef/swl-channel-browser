export type DemodMode = 'AM' | 'USB' | 'LSB' | 'NFM' | 'WFM' | 'CW' | 'SAM';

export interface Broadcast {
  freq_khz: number;
  freq_hz: number;
  time_start: string;
  time_end: string;
  days: string;
  country_code: string;
  station: string;
  language: string;
  language_name: string;
  target: string;
  target_name: string;
  remarks: string;
  band: string;
  demod_mode: DemodMode;
  bandwidth: number;
  seasonal_start: string;
  seasonal_end: string;
}

export interface Favorite {
  id: string;
  freq_khz: number;
  freq_hz: number;
  station: string;
  language: string;
  target: string;
  demod_mode: DemodMode;
  bandwidth: number;
  notes: string;
  added_at: string;
}

export interface ReceptionLogEntry {
  id: string;
  freq_khz: number;
  station: string;
  language: string;
  target: string;
  signal_power: number | null;
  signal_snr: number | null;
  notes: string;
  logged_at: string;
}

export interface AppConfig {
  sdrconnect_host: string;
  sdrconnect_port: number;
  default_demod: DemodMode;
  default_bandwidth: number;
  time_format: 'utc' | 'local';
  theme: 'dark' | 'light';
  auto_play_audio: boolean;
  nrspst_ip: string;
  signal_check_dwell_seconds: number;
}

export type BandCondition = 'good' | 'fair' | 'poor' | 'unknown';

export interface PropagationData {
  kp_index: number;
  solar_flux: number;
  updated_at: string;
  band_conditions: Record<string, BandCondition>;
}

export interface ScheduleResponse {
  count: number;
  utc_time: string;
  broadcasts: Broadcast[];
}

export interface FiltersResponse {
  bands: string[];
  languages: { code: string; name: string }[];
  targets: { code: string; name: string }[];
}

export interface ScheduleFilters {
  band?: string;
  lang?: string;
  target?: string;
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}
