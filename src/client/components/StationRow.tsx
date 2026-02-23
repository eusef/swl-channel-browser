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
      {Math.round(reading.power)} dBm
    </span>
  );
}

interface StationRowProps {
  broadcast: Broadcast;
  isTuned: boolean;
  isFavorite: boolean;
  bandCondition?: BandCondition;
  signalReading?: SignalReading;
  onTune: (broadcast: Broadcast) => void;
  onToggleFavorite: (broadcast: Broadcast) => void;
}

export default function StationRow({ broadcast, isTuned, isFavorite, bandCondition, signalReading, onTune, onToggleFavorite }: StationRowProps) {
  return (
    <tr
      onClick={() => onTune(broadcast)}
      className={`cursor-pointer border-b border-slate-800 transition-colors
        ${isTuned ? 'bg-blue-900/30 text-blue-200' : 'hover:bg-slate-800/50'}`}
    >
      <td className="px-1 py-2 w-10">
        <FavoriteButton
          isFavorite={isFavorite}
          onToggle={() => onToggleFavorite(broadcast)}
        />
      </td>
      <td className="px-3 py-2 font-mono text-sm font-bold whitespace-nowrap">
        {broadcast.freq_khz}
      </td>
      <td className="px-3 py-2 text-sm max-w-[200px] truncate">
        {broadcast.station}
      </td>
      <td className="px-3 py-2 text-xs text-slate-400">
        {broadcast.language_name}
      </td>
      <td className="px-3 py-2 text-xs text-slate-400 hidden lg:table-cell">
        {broadcast.target_name}
      </td>
      <td className="px-3 py-2 text-xs font-mono text-slate-500">
        {broadcast.time_start}-{broadcast.time_end}
      </td>
      <td className="px-3 py-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          {broadcast.band}
          {bandCondition && <BandBadge condition={bandCondition} />}
          {signalReading && <SignalBadge reading={signalReading} />}
        </span>
      </td>
    </tr>
  );
}
