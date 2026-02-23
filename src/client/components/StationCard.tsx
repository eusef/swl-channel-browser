import { Broadcast, BandCondition } from '../../shared/types';
import { SignalReading } from '../hooks/useSignalCheck';
import FavoriteButton from './FavoriteButton';
import BandBadge from './BandBadge';

function SignalBadge({ reading }: { reading: SignalReading }) {
  const hasPower = !isNaN(reading.power);
  if (!hasPower) {
    return <span className="text-[10px] text-slate-600">--</span>;
  }
  const color = reading.power > -80
    ? 'text-green-400'
    : reading.power > -100
      ? 'text-yellow-400'
      : 'text-red-400';
  return (
    <span className={`text-[10px] font-mono ${color}`}>
      {Math.round(reading.power)}
    </span>
  );
}

interface StationCardProps {
  broadcast: Broadcast;
  isTuned: boolean;
  isFavorite: boolean;
  bandCondition?: BandCondition;
  signalReading?: SignalReading;
  onTune: (broadcast: Broadcast) => void;
  onToggleFavorite: (broadcast: Broadcast) => void;
}

export default function StationCard({ broadcast, isTuned, isFavorite, bandCondition, signalReading, onTune, onToggleFavorite }: StationCardProps) {
  return (
    <div
      onClick={() => onTune(broadcast)}
      className={`cursor-pointer border-b border-slate-800 px-4 py-3 transition-colors min-h-[44px] flex items-center gap-2
        ${isTuned ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : 'hover:bg-slate-800/50'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm font-bold text-slate-200">{broadcast.freq_khz}</span>
          <span className="text-sm text-slate-300 truncate flex-1">{broadcast.station}</span>
          <span className="text-xs text-slate-500 inline-flex items-center gap-1">
            {broadcast.band}
            {bandCondition && <BandBadge condition={bandCondition} />}
            {signalReading && <SignalBadge reading={signalReading} />}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
          <span>{broadcast.language_name}</span>
          <span>|</span>
          <span>{broadcast.target_name}</span>
          <span>|</span>
          <span className="font-mono">{broadcast.time_start}-{broadcast.time_end}</span>
        </div>
      </div>
      <FavoriteButton
        isFavorite={isFavorite}
        onToggle={() => onToggleFavorite(broadcast)}
      />
    </div>
  );
}
