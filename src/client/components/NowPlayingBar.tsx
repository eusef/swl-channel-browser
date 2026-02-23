import { Broadcast, DemodMode } from '../../shared/types';
import SignalMeter from './SignalMeter';
import AudioControls from './AudioControls';

const DEMOD_MODES: DemodMode[] = ['AM', 'SAM', 'USB', 'LSB', 'NFM', 'WFM', 'CW'];

interface NowPlayingBarProps {
  broadcast: Broadcast | null;
  power: number | null;
  snr: number | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isRecording: boolean;
  elapsed: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
  onToggleRecord: () => void;
  onDemodChange: (mode: DemodMode) => void;
  nrspstIp?: string;
}

export default function NowPlayingBar({
  broadcast,
  power,
  snr,
  isPlaying,
  volume,
  isMuted,
  isRecording,
  elapsed,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onToggleRecord,
  onDemodChange,
  nrspstIp,
}: NowPlayingBarProps) {
  if (!broadcast) {
    return (
      <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-3 text-slate-500 text-sm">
        Tap a station to tune
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 sticky top-0 z-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-blue-400 font-mono shrink-0">{broadcast.freq_khz} kHz</span>
            <span className="text-slate-300 truncate">{broadcast.station}</span>
            <select
              value={broadcast.demod_mode}
              onChange={(e) => onDemodChange(e.target.value as DemodMode)}
              className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 shrink-0 min-h-[28px]"
            >
              {DEMOD_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <SignalMeter power={power} snr={snr} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AudioControls
            isPlaying={isPlaying}
            volume={volume}
            isMuted={isMuted}
            isRecording={isRecording}
            elapsed={elapsed}
            onTogglePlay={onTogglePlay}
            onToggleMute={onToggleMute}
            onVolumeChange={onVolumeChange}
            onToggleRecord={onToggleRecord}
          />
          {nrspstIp && (
            <a
              href={`http://${nrspstIp}:9001`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] flex items-center text-sm text-blue-400 hover:text-blue-300 active:text-blue-200 whitespace-nowrap px-1"
            >
              Advanced &rarr;
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
