import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StationList } from '../../shared/types';

interface ListSelectorProps {
  lists: StationList[];
  activeListId: string;
  onSelect: (listId: string) => void;
  onCreate: (name: string) => void;
  onRename: (listId: string, name: string) => void;
  onDelete: (listId: string) => void;
}

export default function ListSelector({ lists, activeListId, onSelect, onCreate, onRename, onDelete }: ListSelectorProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const createInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside tap
  useEffect(() => {
    if (!contextMenuId) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [contextMenuId]);

  const openContextMenu = useCallback((listId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setContextMenuId(contextMenuId === listId ? null : listId);
  }, [contextMenuId]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setShowCreate(false);
  };

  const handleRename = (listId: string) => {
    const name = editName.trim();
    if (!name) return;
    onRename(listId, name);
    setEditingId(null);
  };

  const startEdit = (list: StationList) => {
    setEditingId(list.id);
    setEditName(list.name);
    setContextMenuId(null);
  };

  return (
    <div className="border-b border-slate-700 bg-slate-800/60">
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scrollbar-hide"
           style={{ WebkitOverflowScrolling: 'touch' }}>
        {lists.map(list => (
          <div key={list.id} className="relative shrink-0">
            {editingId === list.id ? (
              <form
                onSubmit={e => { e.preventDefault(); handleRename(list.id); }}
                className="flex items-center"
              >
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleRename(list.id)}
                  autoFocus
                  className="bg-slate-700 border border-blue-500 rounded px-2 py-1 text-sm text-slate-100 min-h-[36px] w-28"
                />
              </form>
            ) : (
              <button
                onClick={() => onSelect(list.id)}
                onContextMenu={(e) => openContextMenu(list.id, e)}
                onDoubleClick={() => startEdit(list)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors min-h-[36px] whitespace-nowrap
                  ${list.id === activeListId
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 active:bg-slate-700'
                  }`}
              >
                {list.name}
                <span className="ml-1.5 text-xs opacity-60">{list.stations.length}</span>
              </button>
            )}
          </div>
        ))}

        {/* Create new list */}
        {showCreate ? (
          <form
            onSubmit={e => { e.preventDefault(); handleCreate(); }}
            className="flex items-center gap-1 shrink-0"
          >
            <input
              ref={createInputRef}
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={() => { if (!newName.trim()) setShowCreate(false); }}
              autoFocus
              placeholder="List name"
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-500 min-h-[36px] w-28
                focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="text-blue-400 hover:text-blue-300 text-sm font-medium px-2 min-h-[36px]"
            >
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 px-2 py-1.5 text-slate-500 hover:text-blue-400 active:text-blue-300 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Create new list"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Portal context menu - renders above all content */}
      {contextMenuId && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-slate-700 border border-slate-600 rounded shadow-lg min-w-[140px]"
          style={{ top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
        >
          {(() => {
            const list = lists.find(l => l.id === contextMenuId);
            if (!list) return null;
            return (
              <>
                <button
                  onClick={() => startEdit(list)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-600 min-h-[44px]"
                >
                  Rename
                </button>
                {lists.length > 1 && (
                  <button
                    onClick={() => { onDelete(list.id); setContextMenuId(null); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-600 min-h-[44px]"
                  >
                    Delete
                  </button>
                )}
              </>
            );
          })()}
        </div>,
        document.body,
      )}
    </div>
  );
}
