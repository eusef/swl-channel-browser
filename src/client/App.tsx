import { useState, useCallback, useRef, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Broadcast, AppConfig, DemodMode } from '../shared/types';
import { useWebSocket } from './hooks/useWebSocket';
import { useSchedule } from './hooks/useSchedule';
import { useFilters } from './hooks/useFilters';
import { useSignal } from './hooks/useSignal';
import { useAudio } from './hooks/useAudio';
import { useFavorites } from './hooks/useFavorites';
import { useLog } from './hooks/useLog';
import { useSpectrum } from './hooks/useSpectrum';
import { usePropagation } from './hooks/usePropagation';
import { useRecording } from './hooks/useRecording';
import { fetchConfig } from './lib/schedule';
import ClockBar from './components/ClockBar';
import NowPlayingBar from './components/NowPlayingBar';
import FilterBar from './components/FilterBar';
import LookaheadToggle from './components/LookaheadToggle';
import StationList from './components/StationList';
import FavoritesPage from './components/FavoritesPage';
import LogPage from './components/LogPage';
import SettingsPage from './components/SettingsPage';
import SpectrumPanel from './components/SpectrumPanel';
import PropagationBar from './components/PropagationBar';
import Toast from './components/Toast';

type ViewMode = 'now' | 'upcoming';

/** Standard bandwidth for each demod mode */
function bandwidthForMode(mode: DemodMode): number {
  switch (mode) {
    case 'AM':
    case 'SAM': return 7500;
    case 'USB':
    case 'LSB': return 3000;
    case 'CW':  return 500;
    case 'NFM': return 12500;
    case 'WFM': return 150000;
    default:    return 7500;
  }
}

function MainView() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('now');
  const [lookaheadHours, setLookaheadHours] = useState(3);
  const [tunedBroadcast, setTunedBroadcast] = useState<Broadcast | null>(null);
  const [spectrumExpanded, setSpectrumExpanded] = useState(false);
  const tuneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Load config
  useEffect(() => {
    fetchConfig().then(setConfig).catch(console.error);
  }, []);

  const { status, getClient } = useWebSocket();
  const { filters, available, setFilter, clearFilters } = useFilters();
  const { broadcasts, loading, error } = useSchedule(filters, viewMode, lookaheadHours);
  const { power, snr } = useSignal(getClient, status);
  const audio = useAudio(getClient);
  const favs = useFavorites();
  const log = useLog();
  const spectrumEnabled = spectrumExpanded && tunedBroadcast !== null;
  const { binsRef, frameCountRef, peakShiftRef } = useSpectrum(getClient, status, spectrumEnabled);
  const { propagation, loading: propagationLoading } = usePropagation();
  const recording = useRecording();
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const prevRecordingCountRef = useRef(0);

  // Auto-stop recording when audio stops
  useEffect(() => {
    if (!audio.isPlaying && recording.isRecording) {
      recording.stopRecording();
    }
  }, [audio.isPlaying, recording.isRecording, recording.stopRecording]);

  // Show toast when a new recording is saved
  useEffect(() => {
    const count = recording.recordings.length;
    if (count > prevRecordingCountRef.current && prevRecordingCountRef.current >= 0) {
      setToastMessage('Recording saved! View and download in the Log tab.');
      setToastVisible(true);
    }
    prevRecordingCountRef.current = count;
  }, [recording.recordings.length]);

  const handleToggleRecord = useCallback(() => {
    if (recording.isRecording) {
      recording.stopRecording();
    } else {
      const gainNode = audio.getGainNode();
      const audioCtx = audio.getAudioContext();
      if (gainNode && audioCtx && tunedBroadcast) {
        recording.startRecording(
          gainNode,
          audioCtx,
          tunedBroadcast.freq_khz,
          tunedBroadcast.station,
        );
      }
    }
  }, [recording, audio, tunedBroadcast]);

  // Live demod mode change — sends to SDR immediately and updates state
  const handleDemodChange = useCallback((mode: DemodMode) => {
    const client = getClient();
    if (!client) return;

    const bw = bandwidthForMode(mode);
    client.setDemodulator(mode);
    client.setBandwidth(bw);

    // Update the tuned broadcast state so the UI reflects the change
    setTunedBroadcast(prev =>
      prev ? { ...prev, demod_mode: mode, bandwidth: bw } : prev
    );
  }, [getClient]);

  const handleTune = useCallback(
    (broadcast: Broadcast) => {
      // Debounce: 300ms between user tune actions
      if (tuneTimerRef.current) {
        clearTimeout(tuneTimerRef.current);
      }

      tuneTimerRef.current = setTimeout(() => {
        const client = getClient();
        if (!client) return;

        // For generic broadcasts (SAM from parser), use config default if set
        let demodMode = broadcast.demod_mode;
        let bw = broadcast.bandwidth;
        if (
          config?.default_demod &&
          (broadcast.demod_mode === 'SAM' || broadcast.demod_mode === 'AM')
        ) {
          demodMode = config.default_demod;
          bw = bandwidthForMode(demodMode);
        }

        client.tune(broadcast.freq_hz);
        client.setDemodulator(demodMode);
        client.setBandwidth(bw);

        setTunedBroadcast({ ...broadcast, demod_mode: demodMode, bandwidth: bw });

        // Auto-play audio if configured
        if (config?.auto_play_audio && !audio.isPlaying) {
          audio.startAudio();
        }
      }, 300);
    },
    [getClient, config?.auto_play_audio, config?.default_demod, audio]
  );

  const handleToggleFavorite = useCallback(
    (broadcast: Broadcast) => {
      const existingId = favs.getFavoriteId(broadcast.freq_khz, broadcast.station);
      if (existingId) {
        favs.remove(existingId);
      } else {
        favs.add(broadcast);
      }
    },
    [favs]
  );

  const handleSpectrumExpandedChange = useCallback((expanded: boolean) => {
    setSpectrumExpanded(expanded);
  }, []);

  const handleConfigChange = useCallback((newConfig: AppConfig) => {
    setConfig(prev => {
      // If default_demod changed while we have a tuned station, apply immediately
      if (prev && prev.default_demod !== newConfig.default_demod && tunedBroadcast) {
        const client = getClient();
        if (client) {
          const bw = bandwidthForMode(newConfig.default_demod);
          client.setDemodulator(newConfig.default_demod);
          client.setBandwidth(bw);
          setTunedBroadcast(t =>
            t ? { ...t, demod_mode: newConfig.default_demod, bandwidth: bw } : t
          );
        }
      }
      return newConfig;
    });
  }, [tunedBroadcast, getClient]);

  return (
    <div className="flex flex-col h-dvh bg-slate-900 text-slate-100" style={{
      height: '100dvh',
      paddingTop: 'env(safe-area-inset-top)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>
      <ClockBar connectionStatus={status} />
      <PropagationBar propagation={propagation} loading={propagationLoading} />

      {status === 'disconnected' && (
        <div className="bg-red-900/80 border-b border-red-700 px-4 py-2 flex items-center justify-between gap-2">
          <p className="text-red-200 text-sm">
            Cannot connect to SDR receiver
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="text-red-300 hover:text-red-100 text-xs font-medium shrink-0 underline underline-offset-2"
          >
            Check Settings
          </button>
        </div>
      )}

      <NowPlayingBar
        broadcast={tunedBroadcast}
        power={power}
        snr={snr}
        isPlaying={audio.isPlaying}
        volume={audio.volume}
        isMuted={audio.isMuted}
        isRecording={recording.isRecording}
        elapsed={recording.elapsed}
        onTogglePlay={audio.togglePlay}
        onToggleMute={audio.toggleMute}
        onVolumeChange={audio.changeVolume}
        onToggleRecord={handleToggleRecord}
        onDemodChange={handleDemodChange}
        nrspstIp={config?.nrspst_ip}
      />

      <SpectrumPanel
        binsRef={binsRef}
        frameCountRef={frameCountRef}
        peakShiftRef={peakShiftRef}
        tunedFreqKhz={tunedBroadcast?.freq_khz ?? null}
        onExpandedChange={handleSpectrumExpandedChange}
      />

      <div className="flex flex-col flex-1 min-h-0 overflow-auto">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <FilterBar
                available={available}
                band={filters.band}
                lang={filters.lang}
                target={filters.target}
                q={filters.q}
                onFilterChange={setFilter}
                onClear={clearFilters}
              />
              <LookaheadToggle
                mode={viewMode}
                hours={lookaheadHours}
                onModeChange={setViewMode}
                onHoursChange={setLookaheadHours}
                count={broadcasts.length}
              />
              <StationList
                broadcasts={broadcasts}
                tunedFreq={tunedBroadcast?.freq_khz ?? null}
                onTune={handleTune}
                loading={loading}
                error={error}
                isFavorite={favs.isFavorite}
                onToggleFavorite={handleToggleFavorite}
                bandConditions={propagation?.band_conditions}
              />
            </>
          }
        />
        <Route
          path="/favorites"
          element={
            <FavoritesPage
              favorites={favs.favorites}
              loading={favs.loading}
              onTune={handleTune}
              onRemove={favs.remove}
            />
          }
        />
        <Route
          path="/log"
          element={
            <LogPage
              entries={log.entries}
              loading={log.loading}
              tunedBroadcast={tunedBroadcast}
              power={power}
              snr={snr}
              recordings={recording.recordings}
              onAdd={log.add}
              onRemove={log.remove}
              onExportCsv={log.downloadCsv}
              onDownloadRecording={recording.downloadRecording}
              onDownloadRecordingWav={recording.downloadAsWav}
              onRemoveRecording={recording.removeRecording}
            />
          }
        />
        <Route path="/settings" element={<SettingsPage onConfigChange={handleConfigChange} getClient={getClient} connectionStatus={status} />} />
      </Routes>
      </div>

      <Toast message={toastMessage} visible={toastVisible} onDismiss={() => setToastVisible(false)} />

      {/* Bottom navigation */}
      <nav className="bg-slate-800 border-t border-slate-700 flex justify-around py-2 sm:py-1.5 shrink-0"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {[
          { label: 'Now', onClick: () => { navigate('/'); setViewMode('now'); } },
          { label: 'Soon', onClick: () => { navigate('/'); setViewMode('upcoming'); } },
          { label: 'Favs', onClick: () => navigate('/favorites') },
          { label: 'Log', onClick: () => navigate('/log') },
          { label: 'Settings', onClick: () => navigate('/settings') },
        ].map((item) => {
          const isActive =
            (item.label === 'Now' && location.pathname === '/' && viewMode === 'now') ||
            (item.label === 'Soon' && location.pathname === '/' && viewMode === 'upcoming') ||
            (item.label === 'Favs' && location.pathname === '/favorites') ||
            (item.label === 'Log' && location.pathname === '/log') ||
            (item.label === 'Settings' && location.pathname === '/settings');

          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`px-2 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors min-h-[44px] min-w-[44px]
                ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300 active:text-slate-200'}`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return <MainView />;
}
