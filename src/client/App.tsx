import { useState, useCallback, useRef, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Broadcast, AppConfig, DemodMode } from '../shared/types';
import { useWebSocket } from './hooks/useWebSocket';
import { useSchedule } from './hooks/useSchedule';
import { useFilters } from './hooks/useFilters';
import { useSignal } from './hooks/useSignal';
import { useAudio } from './hooks/useAudio';
import { useLists } from './hooks/useLists';
import { useLog } from './hooks/useLog';
import { useSpectrum } from './hooks/useSpectrum';
import { useNearbyBroadcasts } from './hooks/useNearbyBroadcasts';
import { usePropagation } from './hooks/usePropagation';
import { useRecording } from './hooks/useRecording';
import { useManualEntries } from './hooks/useManualEntries';
import { fetchConfig } from './lib/schedule';
import ClockBar from './components/ClockBar';
import NowPlayingBar from './components/NowPlayingBar';
import FilterBar from './components/FilterBar';
import LookaheadToggle from './components/LookaheadToggle';
import StationList from './components/StationList';
import ListsPage from './components/ListsPage';
import SaveToListModal from './components/SaveToListModal';
import LogPage from './components/LogPage';
import SettingsPage from './components/SettingsPage';
import SpectrumPanel from './components/SpectrumPanel';
import PropagationBar from './components/PropagationBar';
import ManualTuneForm from './components/ManualTuneForm';
import ManualEntryList from './components/ManualEntryList';
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
  const [deviceCenterHz, setDeviceCenterHz] = useState<number | null>(null);
  const [deviceSampleRate, setDeviceSampleRate] = useState<number | null>(null);
  const tuneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retuneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTunedFreqRef = useRef<number>(0);

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
  const listsHook = useLists();
  const log = useLog();
  // Track device center frequency from SDRconnect
  useEffect(() => {
    const client = getClient();
    if (!client) return;
    const unsub = client.onPropertyChange((prop, value) => {
      if (prop === 'device_center_frequency') {
        const hz = parseFloat(value);
        if (!isNaN(hz) && hz > 0) setDeviceCenterHz(hz);
      } else if (prop === 'device_sample_rate') {
        const hz = parseFloat(value);
        if (!isNaN(hz) && hz > 0) setDeviceSampleRate(hz);
      }
    });
    return unsub;
  }, [getClient, status]);

  const spectrumEnabled = spectrumExpanded && tunedBroadcast !== null;
  const { binsRef, frameCountRef, peakShiftRef } = useSpectrum(getClient, status, spectrumEnabled);
  const nearbyBroadcasts = useNearbyBroadcasts(
    spectrumEnabled ? (deviceCenterHz ? Math.round(deviceCenterHz / 1000) : null) : null,
    deviceSampleRate ? Math.round(deviceSampleRate / 1000) : 1000,
  );
  const { propagation, loading: propagationLoading } = usePropagation();
  const recording = useRecording();
  const manualEntries = useManualEntries();
  const [manualFormCollapsed, setManualFormCollapsed] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
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

        // Safety: SDRconnect does not support plain 'AM' - always use 'SAM'
        if (demodMode === 'AM') {
          demodMode = 'SAM';
          bw = bandwidthForMode('SAM');
        }

        // Detect large frequency jumps (>1 MHz) where AGC may need to resettle
        const prevFreq = lastTunedFreqRef.current;
        const freqDeltaKhz = prevFreq ? Math.abs(broadcast.freq_khz - prevFreq) : 0;
        const isLargeJump = freqDeltaKhz > 1000;

        client.tune(broadcast.freq_hz);
        client.setDemodulator(demodMode);
        client.setBandwidth(bw);

        lastTunedFreqRef.current = broadcast.freq_khz;
        setTunedBroadcast({ ...broadcast, demod_mode: demodMode, bandwidth: bw });

        // After a large frequency jump, cycle the SDRconnect audio stream
        // to reset internal gain levels (mirrors manual play/pause toggle)
        if (isLargeJump && audio.isPlaying) {
          if (retuneTimerRef.current) clearTimeout(retuneTimerRef.current);
          retuneTimerRef.current = setTimeout(() => {
            const c = getClient();
            if (c) {
              c.stopAudio();
              setTimeout(() => {
                c.startAudio();
              }, 200);
            }
          }, 400);
        }

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
      const found = listsHook.findStation(broadcast.freq_khz, broadcast.station);
      if (found) {
        listsHook.removeStation(found.listId, found.stationId);
      } else {
        // Add to active list (or first list)
        const targetListId = listsHook.activeListId || listsHook.lists[0]?.id;
        if (targetListId) {
          listsHook.addStation(targetListId, broadcast);
        }
      }
    },
    [listsHook]
  );

  const handleSaveToList = useCallback((listId: string, stationName: string, notes: string) => {
    if (!tunedBroadcast) return;
    const broadcast = { ...tunedBroadcast, station: stationName };
    listsHook.addStation(listId, broadcast, notes);
    setSaveModalOpen(false);
    setToastMessage('Station saved!');
    setToastVisible(true);
  }, [tunedBroadcast, listsHook]);

  const handleCreateListAndSave = useCallback(async (listName: string, stationName: string, notes: string) => {
    if (!tunedBroadcast) return;
    const newList = await listsHook.createList(listName);
    if (newList) {
      const broadcast = { ...tunedBroadcast, station: stationName };
      await listsHook.addStation(newList.id, broadcast, notes);
    }
    setSaveModalOpen(false);
    setToastMessage('Station saved!');
    setToastVisible(true);
  }, [tunedBroadcast, listsHook]);

  const handleSpectrumExpandedChange = useCallback((expanded: boolean) => {
    setSpectrumExpanded(expanded);
  }, []);

  // Spectrum/waterfall click-to-tune: creates an ad-hoc broadcast for the clicked frequency
  const handleSpectrumTune = useCallback((freqHz: number) => {
    const freqKhz = freqHz / 1000;
    // Check if a nearby EiBi broadcast matches (within 1 kHz)
    const match = nearbyBroadcasts.find(
      b => Math.abs(b.freq_khz - freqKhz) < 1,
    );
    if (match) {
      handleTune(match);
    } else {
      // Create ad-hoc broadcast entry
      const demod: DemodMode = config?.default_demod || 'SAM';
      const adHoc: Broadcast = {
        freq_khz: Math.round(freqKhz * 10) / 10,
        freq_hz: Math.round(freqHz),
        time_start: '',
        time_end: '',
        days: '',
        country_code: '',
        station: `${(freqKhz).toFixed(1)} kHz`,
        language: '',
        language_name: '',
        target: '',
        target_name: '',
        remarks: 'Waterfall tune',
        band: '',
        demod_mode: demod,
        bandwidth: bandwidthForMode(demod),
        seasonal_start: '',
        seasonal_end: '',
      };
      handleTune(adHoc);
    }
  }, [nearbyBroadcasts, handleTune, config?.default_demod]);

  // Spectrum/waterfall drag-to-pan: tunes VFO once on drag release
  const handleSpectrumDragEnd = useCallback((deltaHz: number) => {
    const client = getClient();
    if (!client || !tunedBroadcast) return;

    const newFreqHz = Math.max(1000, tunedBroadcast.freq_hz + Math.round(deltaHz));
    const newFreqKhz = newFreqHz / 1000;

    client.tune(newFreqHz);
    setTunedBroadcast(prev => prev ? {
      ...prev,
      freq_hz: newFreqHz,
      freq_khz: Math.round(newFreqKhz * 10) / 10,
      station: `${newFreqKhz.toFixed(1)} kHz`,
      remarks: 'Waterfall drag',
    } : null);
    lastTunedFreqRef.current = newFreqKhz;
  }, [getClient, tunedBroadcast]);

  const handleManualTune = useCallback((params: { freq_khz: number; station?: string; demod_mode: DemodMode; bandwidth: number }) => {
    const entry = manualEntries.add(params);
    const broadcast = manualEntries.toBroadcast(entry);
    handleTune(broadcast);
  }, [manualEntries, handleTune]);

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
        onSaveToList={tunedBroadcast ? () => setSaveModalOpen(true) : undefined}
        nrspstIp={config?.nrspst_ip}
      />

      <SpectrumPanel
        binsRef={binsRef}
        frameCountRef={frameCountRef}
        peakShiftRef={peakShiftRef}
        tunedFreqKhz={tunedBroadcast?.freq_khz ?? null}
        centerFreqHz={deviceCenterHz}
        spanHz={deviceSampleRate}
        vfoFreqHz={tunedBroadcast?.freq_hz ?? null}
        nearbyBroadcasts={nearbyBroadcasts}
        onExpandedChange={handleSpectrumExpandedChange}
        onTuneToFreq={handleSpectrumTune}
        onDragEnd={handleSpectrumDragEnd}
      />

      <ManualTuneForm
        onSubmit={handleManualTune}
        collapsed={manualFormCollapsed}
        onCollapsedChange={setManualFormCollapsed}
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
              <ManualEntryList
                entries={manualEntries.entries}
                tunedFreq={tunedBroadcast?.freq_khz ?? null}
                onTune={handleTune}
                onRemove={manualEntries.remove}
                onClear={manualEntries.clear}
                toBroadcast={manualEntries.toBroadcast}
              />
              <StationList
                broadcasts={broadcasts}
                tunedFreq={tunedBroadcast?.freq_khz ?? null}
                onTune={handleTune}
                loading={loading}
                error={error}
                isFavorite={listsHook.isInAnyList}
                onToggleFavorite={handleToggleFavorite}
                bandConditions={propagation?.band_conditions}
              />
            </>
          }
        />
        <Route
          path="/favorites"
          element={
            <ListsPage
              lists={listsHook.lists}
              activeListId={listsHook.activeListId}
              loading={listsHook.loading}
              onSelectList={listsHook.setActiveListId}
              onCreateList={listsHook.createList}
              onRenameList={listsHook.renameList}
              onDeleteList={listsHook.deleteList}
              onTune={handleTune}
              onRemoveStation={listsHook.removeStation}
              onExportList={listsHook.exportList}
              onImportList={listsHook.importList}
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

      {tunedBroadcast && saveModalOpen && (
        <SaveToListModal
          open={saveModalOpen}
          broadcast={tunedBroadcast}
          lists={listsHook.lists}
          onSave={handleSaveToList}
          onCreateListAndSave={handleCreateListAndSave}
          onClose={() => setSaveModalOpen(false)}
        />
      )}

      <Toast message={toastMessage} visible={toastVisible} onDismiss={() => setToastVisible(false)} />

      {/* Bottom navigation */}
      <nav className="bg-slate-800 border-t border-slate-700 flex justify-around py-2 sm:py-1.5 shrink-0"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {[
          { label: 'Now', onClick: () => { navigate('/'); setViewMode('now'); } },
          { label: 'Soon', onClick: () => { navigate('/'); setViewMode('upcoming'); } },
          { label: 'Lists', onClick: () => navigate('/favorites') },
          { label: 'Log', onClick: () => navigate('/log') },
          { label: 'Settings', onClick: () => navigate('/settings') },
        ].map((item) => {
          const isActive =
            (item.label === 'Now' && location.pathname === '/' && viewMode === 'now') ||
            (item.label === 'Soon' && location.pathname === '/' && viewMode === 'upcoming') ||
            (item.label === 'Lists' && location.pathname === '/favorites') ||
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
