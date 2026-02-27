import { useState, useCallback } from 'react';
import { StationList, Broadcast } from '../../shared/types';

interface SaveToListModalProps {
  open: boolean;
  broadcast: Broadcast;
  lists: StationList[];
  onSave: (listId: string, stationName: string, notes: string) => void;
  onCreateListAndSave: (listName: string, stationName: string, notes: string) => void;
  onClose: () => void;
}

export default function SaveToListModal({ open, broadcast, lists, onSave, onCreateListAndSave, onClose }: SaveToListModalProps) {
  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id || '');
  const [stationName, setStationName] = useState(broadcast.station);
  const [notes, setNotes] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [newListName, setNewListName] = useState('');

  // Reset state when modal opens with new broadcast
  const handleSave = useCallback(() => {
    const name = stationName.trim() || broadcast.station;
    if (createNew) {
      const listName = newListName.trim();
      if (!listName) return;
      onCreateListAndSave(listName, name, notes.trim());
    } else {
      if (!selectedListId) return;
      onSave(selectedListId, name, notes.trim());
    }
  }, [selectedListId, stationName, notes, createNew, newListName, broadcast, onSave, onCreateListAndSave]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[80vh] overflow-auto shadow-xl"
           style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-medium text-slate-200">Save to List</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            &#10005;
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Station info (read-only) */}
          <div className="bg-slate-900/50 rounded px-3 py-2">
            <div className="text-sm font-mono text-blue-300">{broadcast.freq_khz} kHz</div>
            <div className="text-xs text-slate-400 mt-0.5">{broadcast.demod_mode} / {broadcast.bandwidth} Hz</div>
          </div>

          {/* Station name (editable) */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Station Name</label>
            <input
              type="text"
              value={stationName}
              onChange={e => setStationName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 min-h-[44px]
                focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add a note..."
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 min-h-[44px]
                focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* List selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Choose List</label>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => { setSelectedListId(list.id); setCreateNew(false); }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors min-h-[44px] flex items-center justify-between
                    ${!createNew && selectedListId === list.id
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-transparent'
                    }`}
                >
                  <span>{list.name}</span>
                  <span className="text-xs opacity-60">{list.stations.length}</span>
                </button>
              ))}

              {/* Create new list option */}
              <button
                onClick={() => setCreateNew(true)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors min-h-[44px]
                  ${createNew
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-transparent'
                  }`}
              >
                + Create new list
              </button>
            </div>

            {createNew && (
              <input
                type="text"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                placeholder="New list name"
                autoFocus
                className="w-full mt-2 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 min-h-[44px]
                  focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 rounded min-h-[44px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded min-h-[44px] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
