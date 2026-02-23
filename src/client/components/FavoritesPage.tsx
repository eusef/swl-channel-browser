import { Favorite, Broadcast } from '../../shared/types';
import { getLanguageName, getTargetName } from '../../shared/constants';

interface FavoritesPageProps {
  favorites: Favorite[];
  loading: boolean;
  onTune: (broadcast: Broadcast) => void;
  onRemove: (id: string) => void;
}

export default function FavoritesPage({ favorites, loading, onTune, onRemove }: FavoritesPageProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8 text-slate-500 text-sm">
        Loading favorites...
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500 text-sm gap-2">
        <span className="text-3xl">&#9734;</span>
        <p>No favorites yet</p>
        <p className="text-xs text-slate-600">Tap the star on any station to save it here</p>
      </div>
    );
  }

  // Convert Favorite to a Broadcast-like object for tuning
  function tuneFromFavorite(fav: Favorite) {
    const asBroadcast: Broadcast = {
      freq_khz: fav.freq_khz,
      freq_hz: fav.freq_hz,
      station: fav.station,
      language: fav.language,
      language_name: getLanguageName(fav.language),
      target: fav.target,
      target_name: getTargetName(fav.target),
      demod_mode: fav.demod_mode,
      bandwidth: fav.bandwidth,
      // Fields not needed for tuning
      time_start: '',
      time_end: '',
      days: '',
      country_code: '',
      remarks: '',
      band: '',
      seasonal_start: '',
      seasonal_end: '',
    };
    onTune(asBroadcast);
  }

  return (
    <div className="overflow-auto flex-1">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          onClick={() => tuneFromFavorite(fav)}
          className="cursor-pointer border-b border-slate-800 px-4 py-3 hover:bg-slate-800/50 transition-colors flex items-center gap-3"
        >
          <span className="text-yellow-400 text-lg shrink-0">&#9733;</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold text-slate-200">{fav.freq_khz} kHz</span>
              <span className="text-sm text-slate-300 truncate">{fav.station}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <span>{getLanguageName(fav.language)}</span>
              {fav.target && (
                <>
                  <span>|</span>
                  <span>{getTargetName(fav.target)}</span>
                </>
              )}
              <span>|</span>
              <span>{fav.demod_mode}</span>
              {fav.notes && (
                <>
                  <span>|</span>
                  <span className="text-slate-400 truncate">{fav.notes}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(fav.id);
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors shrink-0"
            aria-label="Remove favorite"
          >
            &#10005;
          </button>
        </div>
      ))}
    </div>
  );
}
