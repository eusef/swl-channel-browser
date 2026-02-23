import { Broadcast, DemodMode } from '../../shared/types.js';
import { getBand, getLanguageName, getTargetName } from '../../shared/constants.js';

function deriveDemodMode(language: string, remarks: string, freq_khz: number): { mode: DemodMode; bandwidth: number } {
  if (language === '-CW') {
    return { mode: 'CW', bandwidth: 3000 };
  }

  const lowerRemarks = remarks.toLowerCase();
  if (lowerRemarks.includes('ssb') || lowerRemarks.includes('usb') || lowerRemarks.includes('lsb')) {
    const mode: DemodMode = freq_khz >= 10000 ? 'USB' : 'LSB';
    return { mode, bandwidth: 3000 };
  }

  return { mode: 'SAM', bandwidth: 7500 };
}

export function parseEibiCsv(csvContent: string): Broadcast[] {
  const lines = csvContent.split('\n');
  const broadcasts: Broadcast[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip header row
    if (trimmed.startsWith('kHz')) continue;

    const fields = trimmed.split(';');
    if (fields.length < 7) continue;

    const freqStr = fields[0]?.trim();
    if (!freqStr) continue;

    const freq_khz = parseFloat(freqStr);
    if (isNaN(freq_khz) || freq_khz <= 0) continue;

    const timeField = fields[1]?.trim() || '';
    const timeParts = timeField.split('-');
    if (timeParts.length !== 2) continue;

    const time_start = timeParts[0].trim();
    const time_end = timeParts[1].trim();

    if (!/^\d{4}$/.test(time_start) || !/^\d{4}$/.test(time_end)) continue;

    const days = fields[2]?.trim() || '';
    const country_code = fields[3]?.trim() || '';
    const station = fields[4]?.trim() || '';
    const language = fields[5]?.trim() || '';
    const target = fields[6]?.trim() || '';
    const remarks = fields[7]?.trim() || '';
    const seasonal_start = fields[9]?.trim() || '';
    const seasonal_end = fields[10]?.trim() || '';

    const freq_hz = Math.round(freq_khz * 1000);
    const band = getBand(freq_khz);
    const { mode: demod_mode, bandwidth } = deriveDemodMode(language, remarks, freq_khz);
    const language_name = getLanguageName(language);
    const target_name = getTargetName(target);

    broadcasts.push({
      freq_khz,
      freq_hz,
      time_start,
      time_end,
      days,
      country_code,
      station,
      language,
      language_name,
      target,
      target_name,
      remarks,
      band,
      demod_mode,
      bandwidth,
      seasonal_start,
      seasonal_end,
    });
  }

  return broadcasts;
}
