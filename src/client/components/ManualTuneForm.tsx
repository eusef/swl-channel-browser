import { useState, useCallback, FormEvent } from 'react';
import { DemodMode } from '../../shared/types';
import { normalizeFrequency, validateFrequency, bandwidthForMode } from '../lib/frequencyUtils';

// SAM first - it's the default for SDRconnect AM reception.
// Plain 'AM' is not a valid SDRconnect demodulator and will drop the connection.
const DEMOD_MODES: DemodMode[] = ['SAM', 'AM', 'USB', 'LSB', 'CW', 'NFM', 'WFM'];

interface ManualTuneFormProps {
  onSubmit: (params: { freq_khz: number; station?: string; demod_mode: DemodMode; bandwidth: number }) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function ManualTuneForm({ onSubmit, collapsed, onCollapsedChange }: ManualTuneFormProps) {
  const [freqInput, setFreqInput] = useState('');
  const [stationName, setStationName] = useState('');
  const [demodMode, setDemodMode] = useState<DemodMode>('SAM');
  const [freqError, setFreqError] = useState('');
  const [freqBand, setFreqBand] = useState('');
  const [freqWarning, setFreqWarning] = useState('');

  const bandwidth = bandwidthForMode(demodMode);

  const handleFreqChange = useCallback((value: string) => {
    setFreqInput(value);
    setFreqError('');
    setFreqWarning('');
    setFreqBand('');

    if (!value.trim()) return;

    const parsed = normalizeFrequency(value);
    if (!parsed) {
      setFreqError('Invalid frequency');
      return;
    }

    const validation = validateFrequency(parsed.freq_khz);
    if (!validation.valid) {
      setFreqError(validation.warning || 'Invalid frequency');
    } else {
      setFreqBand(validation.band !== 'OOB' ? validation.band : '');
      if (validation.warning) setFreqWarning(validation.warning);
    }
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();

    const parsed = normalizeFrequency(freqInput);
    if (!parsed) {
      setFreqError('Enter a valid frequency');
      return;
    }

    const validation = validateFrequency(parsed.freq_khz);
    if (!validation.valid) {
      setFreqError(validation.warning || 'Invalid frequency');
      return;
    }

    onSubmit({
      freq_khz: parsed.freq_khz,
      station: stationName.trim() || undefined,
      demod_mode: demodMode,
      bandwidth,
    });

    // Reset form
    setFreqInput('');
    setStationName('');
    setDemodMode('SAM');
    setFreqError('');
    setFreqWarning('');
    setFreqBand('');
  }, [freqInput, stationName, demodMode, bandwidth, onSubmit]);

  return (
    <div className="border-b border-slate-700 bg-slate-800/50">
      {/* Toggle header */}
      <button
        onClick={() => onCollapsedChange(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 active:bg-slate-700/50 transition-colors min-h-[44px]"
      >
        <span>Manual Tune</span>
        <svg
          className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible form */}
      {!collapsed && (
        <form onSubmit={handleSubmit} className="px-4 pb-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Frequency input */}
            <div className="relative">
              <label className="block text-xs text-slate-400 mb-1">Frequency (kHz)</label>
              <input
                type="text"
                inputMode="decimal"
                value={freqInput}
                onChange={e => handleFreqChange(e.target.value)}
                placeholder="e.g. 7200"
                className={`w-full bg-slate-700 border rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 min-h-[44px]
                  ${freqError ? 'border-red-500' : freqWarning ? 'border-yellow-500' : 'border-slate-600'}
                  focus:outline-none focus:ring-1 focus:ring-blue-500`}
                autoComplete="off"
              />
              {freqBand && (
                <span className="absolute right-2 top-[28px] text-xs text-blue-400 bg-slate-700 px-1">
                  {freqBand}
                </span>
              )}
              {freqError && <p className="text-xs text-red-400 mt-0.5">{freqError}</p>}
              {freqWarning && !freqError && <p className="text-xs text-yellow-400 mt-0.5">{freqWarning}</p>}
            </div>

            {/* Station name */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Station (optional)</label>
              <input
                type="text"
                value={stationName}
                onChange={e => setStationName(e.target.value)}
                placeholder="Station name"
                maxLength={80}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 min-h-[44px]
                  focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
            </div>

            {/* Demod mode */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Mode</label>
              <select
                value={demodMode}
                onChange={e => setDemodMode(e.target.value as DemodMode)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 min-h-[44px]
                  focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DEMOD_MODES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Bandwidth (read-only) + Tune button */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">BW (Hz)</label>
                <input
                  type="text"
                  value={bandwidth}
                  readOnly
                  className="w-full bg-slate-700/50 border border-slate-600 rounded px-3 py-2 text-sm text-slate-400 min-h-[44px] cursor-default"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium px-5 py-2 rounded text-sm min-h-[44px] min-w-[44px] transition-colors shrink-0"
              >
                Tune
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
