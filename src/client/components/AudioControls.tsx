interface AudioControlsProps {
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isRecording: boolean;
  elapsed: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
  onToggleRecord: () => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioControls({
  isPlaying,
  volume,
  isMuted,
  isRecording,
  elapsed,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onToggleRecord,
}: AudioControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onTogglePlay}
        className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-200 text-base"
        title={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? '⏹' : '▶'}
      </button>
      <button
        onClick={onToggleRecord}
        disabled={!isPlaying && !isRecording}
        className={`w-11 h-11 flex items-center justify-center rounded-lg text-base transition-colors
          ${isRecording
            ? 'bg-red-600 hover:bg-red-500 active:bg-red-400 text-white'
            : 'bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-red-400'}
          ${!isPlaying && !isRecording ? 'opacity-40 cursor-not-allowed' : ''}`}
        title={isRecording ? 'Stop Recording' : 'Record'}
      >
        {isRecording ? '⏹' : '⏺'}
      </button>
      {isRecording && (
        <span className="text-red-400 text-xs font-mono tabular-nums min-w-[3ch]">
          {formatElapsed(elapsed)}
        </span>
      )}
      <button
        onClick={onToggleMute}
        className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-200 text-base"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={isMuted ? 0 : volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="w-24 sm:w-20 h-2 accent-blue-500"
      />
    </div>
  );
}
