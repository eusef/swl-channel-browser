import { useRef } from 'react';
import { StationList, Favorite, Broadcast } from '../../shared/types';
import { getLanguageName, getTargetName } from '../../shared/constants';
import ListSelector from './ListSelector';

interface ListsPageProps {
  lists: StationList[];
  activeListId: string;
  loading: boolean;
  onSelectList: (listId: string) => void;
  onCreateList: (name: string) => void;
  onRenameList: (listId: string, name: string) => void;
  onDeleteList: (listId: string) => void;
  onTune: (broadcast: Broadcast) => void;
  onRemoveStation: (listId: string, stationId: string) => void;
  onExportList: (listId: string) => void;
  onImportList: (file: File) => void;
}

function tuneFromFavorite(fav: Favorite, onTune: (b: Broadcast) => void) {
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

export default function ListsPage({
  lists,
  activeListId,
  loading,
  onSelectList,
  onCreateList,
  onRenameList,
  onDeleteList,
  onTune,
  onRemoveStation,
  onExportList,
  onImportList,
}: ListsPageProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const activeList = lists.find(l => l.id === activeListId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8 text-slate-500 text-sm">
        Loading lists...
      </div>
    );
  }

  const handleImportClick = () => {
    importRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportList(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ListSelector
        lists={lists}
        activeListId={activeListId}
        onSelect={onSelectList}
        onCreate={onCreateList}
        onRename={onRenameList}
        onDelete={onDeleteList}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-700 bg-slate-800/40">
        <span className="text-xs text-slate-500">
          {activeList ? `${activeList.stations.length} station${activeList.stations.length !== 1 ? 's' : ''}` : ''}
        </span>
        <div className="flex items-center gap-2">
          {activeList && (
            <button
              onClick={() => onExportList(activeListId)}
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors px-2 min-h-[32px]"
            >
              Export
            </button>
          )}
          <button
            onClick={handleImportClick}
            className="text-xs text-slate-400 hover:text-blue-400 transition-colors px-2 min-h-[32px]"
          >
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Station list */}
      <div className="overflow-auto flex-1">
        {!activeList || activeList.stations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-500 text-sm gap-2">
            <span className="text-3xl">&#9734;</span>
            <p>No stations in this list</p>
            <p className="text-xs text-slate-600">
              Use the star on any station, or save from NowPlaying
            </p>
          </div>
        ) : (
          activeList.stations
            .slice()
            .sort((a, b) => b.added_at.localeCompare(a.added_at))
            .map(fav => (
              <div
                key={fav.id}
                onClick={() => tuneFromFavorite(fav, onTune)}
                className="cursor-pointer border-b border-slate-800 px-4 py-3 hover:bg-slate-800/50 active:bg-slate-700/50 transition-colors flex items-center gap-3 min-h-[56px]"
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
                    onRemoveStation(activeListId, fav.id);
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors shrink-0"
                  aria-label="Remove station"
                >
                  &#10005;
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
