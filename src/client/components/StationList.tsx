import { Broadcast, BandCondition } from '../../shared/types';
import { SignalReading, signalKey } from '../hooks/useSignalCheck';
import StationRow from './StationRow';
import StationCard from './StationCard';

interface StationListProps {
  broadcasts: Broadcast[];
  tunedFreq: number | null;
  onTune: (broadcast: Broadcast) => void;
  loading: boolean;
  error: string | null;
  isFavorite: (freq_khz: number, station: string) => boolean;
  onToggleFavorite: (broadcast: Broadcast) => void;
  bandConditions?: Record<string, BandCondition>;
  signalReadings?: Map<string, SignalReading>;
}

export default function StationList({ broadcasts, tunedFreq, onTune, loading, error, isFavorite, onToggleFavorite, bandConditions, signalReadings }: StationListProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (loading && broadcasts.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8 text-slate-500 text-sm">
        Loading schedule...
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8 text-slate-500 text-sm">
        No broadcasts found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-auto flex-1">
        <table className="w-full">
          <thead className="bg-slate-800/80 sticky top-0">
            <tr className="text-left text-xs text-slate-400 uppercase">
              <th className="px-1 py-2 w-10"></th>
              <th className="px-3 py-2 font-medium">kHz</th>
              <th className="px-3 py-2 font-medium">Station</th>
              <th className="px-3 py-2 font-medium">Language</th>
              <th className="px-3 py-2 font-medium hidden lg:table-cell">Target</th>
              <th className="px-3 py-2 font-medium">Time (UTC)</th>
              <th className="px-3 py-2 font-medium">Band</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b, i) => (
              <StationRow
                key={`${b.freq_khz}-${b.station}-${i}`}
                broadcast={b}
                isTuned={b.freq_khz === tunedFreq}
                isFavorite={isFavorite(b.freq_khz, b.station)}
                bandCondition={bandConditions?.[b.band]}
                signalReading={signalReadings?.get(signalKey(b.freq_khz, b.station))}
                onTune={onTune}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden overflow-auto flex-1">
        {broadcasts.map((b, i) => (
          <StationCard
            key={`${b.freq_khz}-${b.station}-${i}`}
            broadcast={b}
            isTuned={b.freq_khz === tunedFreq}
            isFavorite={isFavorite(b.freq_khz, b.station)}
            bandCondition={bandConditions?.[b.band]}
            signalReading={signalReadings?.get(signalKey(b.freq_khz, b.station))}
            onTune={onTune}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </>
  );
}
