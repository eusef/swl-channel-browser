import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadLog,
  addLogEntry,
  removeLogEntry,
  exportCsv,
} from './log-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.resolve(__dirname, '../../../data/reception-log.json');

describe('log-store', () => {
  let backup: string | null = null;

  beforeEach(() => {
    try {
      backup = fs.readFileSync(LOG_PATH, 'utf-8');
    } catch {
      backup = null;
    }
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOG_PATH, '[]', 'utf-8');
  });

  afterEach(() => {
    if (backup !== null) {
      fs.writeFileSync(LOG_PATH, backup, 'utf-8');
    } else {
      try { fs.unlinkSync(LOG_PATH); } catch { /* ignore */ }
    }
  });

  it('loadLog returns empty array when no file', () => {
    try { fs.unlinkSync(LOG_PATH); } catch { /* ignore */ }
    expect(loadLog()).toEqual([]);
  });

  it('addLogEntry creates entry with id and timestamp', () => {
    const entry = addLogEntry({
      freq_khz: 9500,
      station: 'CRI',
      language: 'E',
      target: 'NAm',
      signal_power: -45,
      signal_snr: 31,
      notes: 'Very clear',
    });

    expect(entry.id).toBeDefined();
    expect(entry.freq_khz).toBe(9500);
    expect(entry.signal_power).toBe(-45);
    expect(entry.signal_snr).toBe(31);
    expect(entry.notes).toBe('Very clear');
    expect(entry.logged_at).toBeDefined();
  });

  it('addLogEntry persists to file', () => {
    addLogEntry({
      freq_khz: 6000,
      station: 'RHC',
      language: 'S',
      target: 'CAm',
      signal_power: null,
      signal_snr: null,
      notes: '',
    });

    const loaded = loadLog();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].station).toBe('RHC');
  });

  it('removeLogEntry deletes by id', () => {
    const entry = addLogEntry({
      freq_khz: 9500,
      station: 'CRI',
      language: 'E',
      target: 'NAm',
      signal_power: -50,
      signal_snr: 20,
      notes: '',
    });

    expect(removeLogEntry(entry.id)).toBe(true);
    expect(loadLog()).toHaveLength(0);
  });

  it('removeLogEntry returns false for nonexistent id', () => {
    expect(removeLogEntry('nonexistent-id')).toBe(false);
  });

  it('handles null signal values', () => {
    const entry = addLogEntry({
      freq_khz: 9500,
      station: 'CRI',
      language: 'E',
      target: 'NAm',
      signal_power: null,
      signal_snr: null,
      notes: '',
    });

    expect(entry.signal_power).toBeNull();
    expect(entry.signal_snr).toBeNull();
  });

  it('exportCsv generates valid CSV', () => {
    addLogEntry({
      freq_khz: 9500,
      station: 'China Radio Intl',
      language: 'E',
      target: 'NAm',
      signal_power: -45,
      signal_snr: 31,
      notes: 'Clear signal',
    });
    addLogEntry({
      freq_khz: 6000,
      station: 'Radio Havana Cuba',
      language: 'S',
      target: 'CAm',
      signal_power: null,
      signal_snr: null,
      notes: '',
    });

    const csv = exportCsv();
    const lines = csv.split('\n');

    // Header + 2 data rows
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Frequency (kHz)');
    expect(lines[0]).toContain('Station');
    expect(lines[0]).toContain('Signal (dBm)');
    expect(lines[1]).toContain('9500');
    expect(lines[1]).toContain('China Radio Intl');
    expect(lines[2]).toContain('6000');
  });

  it('exportCsv handles empty log', () => {
    const csv = exportCsv();
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // Just the header
    expect(lines[0]).toContain('Date/Time');
  });

  it('exportCsv escapes commas in fields', () => {
    addLogEntry({
      freq_khz: 9500,
      station: 'Station, With Comma',
      language: 'E',
      target: 'NAm',
      signal_power: -50,
      signal_snr: 20,
      notes: 'Notes, with comma',
    });

    const csv = exportCsv();
    // Comma-containing fields should be quoted
    expect(csv).toContain('"Station, With Comma"');
    expect(csv).toContain('"Notes, with comma"');
  });

  it('handles multiple entries', () => {
    addLogEntry({ freq_khz: 9500, station: 'CRI', language: 'E', target: 'NAm', signal_power: -45, signal_snr: 31, notes: '' });
    addLogEntry({ freq_khz: 6000, station: 'RHC', language: 'S', target: 'CAm', signal_power: -60, signal_snr: 15, notes: '' });
    addLogEntry({ freq_khz: 9700, station: 'VOA', language: 'E', target: 'Af', signal_power: -70, signal_snr: 8, notes: '' });

    expect(loadLog()).toHaveLength(3);
  });
});
