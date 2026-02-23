import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ReceptionLogEntry } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.resolve(__dirname, '../../../data/reception-log.json');

export function loadLog(): ReceptionLogEntry[] {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveLog(entries: ReceptionLogEntry[]): void {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

export function addLogEntry(
  data: Omit<ReceptionLogEntry, 'id' | 'logged_at'>
): ReceptionLogEntry {
  const entries = loadLog();
  const entry: ReceptionLogEntry = {
    id: crypto.randomUUID(),
    ...data,
    logged_at: new Date().toISOString(),
  };
  entries.push(entry);
  saveLog(entries);
  return entry;
}

export function removeLogEntry(id: string): boolean {
  const entries = loadLog();
  const filtered = entries.filter(e => e.id !== id);
  if (filtered.length === entries.length) return false;
  saveLog(filtered);
  return true;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCsv(): string {
  const entries = loadLog();
  const headers = [
    'Date/Time',
    'Frequency (kHz)',
    'Station',
    'Language',
    'Target',
    'Signal (dBm)',
    'SNR (dB)',
    'Notes',
  ];

  const rows = entries.map(e => [
    e.logged_at,
    String(e.freq_khz),
    escapeCsvField(e.station),
    e.language,
    e.target,
    e.signal_power !== null ? String(e.signal_power) : '',
    e.signal_snr !== null ? String(e.signal_snr) : '',
    escapeCsvField(e.notes),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
