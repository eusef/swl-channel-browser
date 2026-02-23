import { describe, it, expect } from 'vitest';
import { parseEibiCsv } from './eibi-parser.js';

const HEADER = 'kHz;Time(UTC);Days;ITU;Station;Lng;Target;Remarks;P;Start;End\n';

function makeLine(
  freq = '9500',
  time = '0000-2400',
  days = '',
  itu = 'CHN',
  station = 'China Radio Intl',
  lang = 'E',
  target = 'NAm',
  remarks = '',
  p = '',
  start = '',
  end = ''
) {
  return `${freq};${time};${days};${itu};${station};${lang};${target};${remarks};${p};${start};${end}`;
}

describe('parseEibiCsv', () => {
  it('parses a valid single-line CSV', () => {
    const csv = HEADER + makeLine();
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].freq_khz).toBe(9500);
    expect(result[0].freq_hz).toBe(9500000);
    expect(result[0].station).toBe('China Radio Intl');
    expect(result[0].language).toBe('E');
    expect(result[0].language_name).toBe('English');
    expect(result[0].target).toBe('NAm');
  });

  it('skips the header row', () => {
    const csv = HEADER;
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(0);
  });

  it('skips empty lines', () => {
    const csv = HEADER + '\n\n' + makeLine() + '\n\n';
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(1);
  });

  it('skips lines with fewer than 7 fields', () => {
    const csv = HEADER + '9500;0000-2400;;\n';
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(0);
  });

  it('skips lines with invalid frequency', () => {
    const csv = HEADER + makeLine('abc');
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(0);
  });

  it('skips lines with zero frequency', () => {
    const csv = HEADER + makeLine('0');
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(0);
  });

  it('skips lines with invalid time format', () => {
    const csv = HEADER + makeLine('9500', 'bad-time');
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(0);
  });

  it('handles decimal frequencies', () => {
    const csv = HEADER + makeLine('9504.5');
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].freq_khz).toBe(9504.5);
    expect(result[0].freq_hz).toBe(9504500);
  });

  it('derives band from frequency', () => {
    const csv31m = HEADER + makeLine('9500');
    expect(parseEibiCsv(csv31m)[0].band).toBe('31m');

    const csv49m = HEADER + makeLine('6000');
    expect(parseEibiCsv(csv49m)[0].band).toBe('49m');

    const csv25m = HEADER + makeLine('11800');
    expect(parseEibiCsv(csv25m)[0].band).toBe('25m');
  });

  it('marks out-of-band frequencies as OOB', () => {
    const csv = HEADER + makeLine('500');
    expect(parseEibiCsv(csv)[0].band).toBe('OOB');
  });

  it('derives SAM demod mode by default', () => {
    const csv = HEADER + makeLine();
    const result = parseEibiCsv(csv);
    expect(result[0].demod_mode).toBe('SAM');
    expect(result[0].bandwidth).toBe(7500);
  });

  it('derives CW for Morse Code language', () => {
    const csv = HEADER + makeLine('9500', '0000-2400', '', 'CHN', 'Station', '-CW', 'NAm');
    const result = parseEibiCsv(csv);
    expect(result[0].demod_mode).toBe('CW');
    expect(result[0].bandwidth).toBe(3000);
  });

  it('derives USB for SSB remarks above 10 MHz', () => {
    const csv = HEADER + makeLine('14000', '0000-2400', '', 'USA', 'Station', 'E', 'NAm', 'SSB');
    const result = parseEibiCsv(csv);
    expect(result[0].demod_mode).toBe('USB');
    expect(result[0].bandwidth).toBe(3000);
  });

  it('derives LSB for SSB remarks below 10 MHz', () => {
    const csv = HEADER + makeLine('7100', '0000-2400', '', 'USA', 'Station', 'E', 'NAm', 'usb mode');
    const result = parseEibiCsv(csv);
    expect(result[0].demod_mode).toBe('LSB');
    expect(result[0].bandwidth).toBe(3000);
  });

  it('parses time start and end correctly', () => {
    const csv = HEADER + makeLine('9500', '0830-1630');
    const result = parseEibiCsv(csv);
    expect(result[0].time_start).toBe('0830');
    expect(result[0].time_end).toBe('1630');
  });

  it('parses days field', () => {
    const csv = HEADER + makeLine('9500', '0000-2400', 'Mo-Fr');
    const result = parseEibiCsv(csv);
    expect(result[0].days).toBe('Mo-Fr');
  });

  it('parses seasonal fields', () => {
    const csv = HEADER + makeLine('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm', '', '', '1026', '0329');
    const result = parseEibiCsv(csv);
    expect(result[0].seasonal_start).toBe('1026');
    expect(result[0].seasonal_end).toBe('0329');
  });

  it('parses multiple lines', () => {
    const csv = HEADER
      + makeLine('9500', '0000-2400', '', 'CHN', 'CRI', 'E', 'NAm') + '\n'
      + makeLine('6175', '0100-0300', 'Mo-Fr', 'USA', 'VOA', 'E', 'Af') + '\n'
      + makeLine('15400', '1200-1400', '', 'IND', 'AIR', 'Hi', 'SEAs');
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(3);
    expect(result[0].freq_khz).toBe(9500);
    expect(result[1].freq_khz).toBe(6175);
    expect(result[2].freq_khz).toBe(15400);
  });

  it('handles empty optional fields gracefully', () => {
    const csv = HEADER + '9500;0000-2400;;CHN;CRI;E;NAm\n';
    const result = parseEibiCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].days).toBe('');
    expect(result[0].remarks).toBe('');
  });
});
