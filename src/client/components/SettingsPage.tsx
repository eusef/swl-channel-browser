import { useState, useEffect } from 'react';
import { AppConfig, DemodMode } from '../../shared/types';
import { fetchConfig, updateConfig, fetchScheduleStatus, ScheduleStatus } from '../lib/schedule';
import { SDRConnectClient } from '../lib/sdrconnect';
import { ConnectionStatus } from '../hooks/useWebSocket';

const ANTENNA_PORTS = [
  { value: 'Port A', label: 'Port A' },
  { value: 'Port B', label: 'Port B' },
  { value: 'Port C', label: 'Port C' },
];

interface SettingsPageProps {
  onConfigChange: (config: AppConfig) => void;
  getClient?: () => SDRConnectClient | null;
  connectionStatus?: ConnectionStatus;
}

export default function SettingsPage({ onConfigChange, getClient, connectionStatus }: SettingsPageProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [antennaPort, setAntennaPort] = useState('Port A');
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);

  useEffect(() => {
    fetchConfig().then(setConfig).catch(console.error);
    fetchScheduleStatus().then(setScheduleStatus).catch(console.error);
  }, []);

  if (!config) {
    return <div className="p-4 text-slate-500">Loading settings...</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateConfig(config);
      setConfig(updated);
      onConfigChange(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<AppConfig>) => {
    setConfig(prev => prev ? { ...prev, ...patch } : prev);
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <h2 className="text-lg font-bold text-slate-100">Settings</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">SDRconnect Host</label>
          <input
            type="text"
            value={config.sdrconnect_host}
            onChange={(e) => update({ sdrconnect_host: e.target.value })}
            className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">SDRconnect Port</label>
          <input
            type="number"
            value={config.sdrconnect_port}
            onChange={(e) => update({ sdrconnect_port: parseInt(e.target.value) || 5454 })}
            className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Default Demod Mode</label>
          <select
            value={config.default_demod}
            onChange={(e) => update({ default_demod: e.target.value as DemodMode })}
            className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600"
          >
            {['AM', 'USB', 'LSB', 'NFM', 'WFM', 'CW', 'SAM'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Default Bandwidth (Hz)</label>
          <input
            type="number"
            value={config.default_bandwidth}
            onChange={(e) => update({ default_bandwidth: parseInt(e.target.value) || 7500 })}
            className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-400">Time Format</label>
          <select
            value={config.time_format}
            onChange={(e) => update({ time_format: e.target.value as 'utc' | 'local' })}
            className="bg-slate-700 text-slate-200 rounded px-3 py-1.5 text-sm border border-slate-600"
          >
            <option value="utc">UTC</option>
            <option value="local">Local</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-400">Theme</label>
          <select
            value={config.theme}
            onChange={(e) => update({ theme: e.target.value as 'dark' | 'light' })}
            className="bg-slate-700 text-slate-200 rounded px-3 py-1.5 text-sm border border-slate-600"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-400">Auto-play Audio on Tune</label>
          <input
            type="checkbox"
            checked={config.auto_play_audio}
            onChange={(e) => update({ auto_play_audio: e.target.checked })}
            className="w-4 h-4 accent-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Signal Check Dwell Time (seconds)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={config.signal_check_dwell_seconds}
            onChange={(e) => update({ signal_check_dwell_seconds: Math.max(1, Math.min(10, parseInt(e.target.value) || 2)) })}
            className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600"
          />
          <p className="text-xs text-slate-500 mt-1">
            How long to listen on each frequency during signal check (1-10s)
          </p>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Antenna Port</label>
          <select
            value={antennaPort}
            onChange={(e) => {
              const port = e.target.value;
              setAntennaPort(port);
              const client = getClient?.();
              if (client) {
                client.setAntennaPort(port);
              }
            }}
            disabled={connectionStatus !== 'connected'}
            className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ANTENNA_PORTS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            For multi-port receivers (RSPdx-R2, RSPduo, nRSP-ST). Requires SDR connection.
          </p>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">nRSP-ST IP (optional)</label>
          <input
            type="text"
            value={config.nrspst_ip}
            onChange={(e) => update({ nrspst_ip: e.target.value })}
            placeholder="e.g., 192.168.1.215"
            className="w-full bg-slate-700 text-slate-200 rounded px-3 py-2 text-sm border border-slate-600 placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            If set, an "Advanced Controls" link will appear pointing to port 9001
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded px-4 py-2 text-sm font-medium transition-colors"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>

      <div className="border-t border-slate-700/50 mt-8 pt-4 space-y-3">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Data Sources</h3>

        <div className="space-y-1">
          <p className="text-xs text-slate-500">
            Station database:{' '}
            <a
              href="http://www.eibispace.de/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline hover:text-slate-300 transition-colors"
            >
              EiBi Short-wave Schedules
            </a>
            {' '}by Eike Bierwirth
          </p>
          {scheduleStatus && (
            <div className="text-[11px] text-slate-600 pl-2 space-y-0.5">
              {scheduleStatus.broadcast_count > 0 && (
                <p>{scheduleStatus.broadcast_count.toLocaleString()} broadcasts loaded</p>
              )}
              {scheduleStatus.loaded_at && (
                <p>
                  Last updated:{' '}
                  {new Date(scheduleStatus.loaded_at).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}
              <p>Auto-refreshes every {scheduleStatus.refresh_interval_hours} hours ({Math.round(scheduleStatus.refresh_interval_hours / 24)} days)</p>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Propagation data:{' '}
          <a
            href="https://www.swpc.noaa.gov/communities/radio-communications"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline hover:text-slate-300 transition-colors"
          >
            NOAA Space Weather Prediction Center
          </a>
        </p>
      </div>

      <p className="text-xs text-slate-600 text-center mt-4">
        For use with genuine SDRplay hardware only.
      </p>
    </div>
  );
}
