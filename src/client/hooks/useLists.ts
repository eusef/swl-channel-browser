import { useState, useEffect, useCallback } from 'react';
import { StationList, Favorite, Broadcast } from '../../shared/types';
import {
  fetchLists,
  createListApi,
  renameListApi,
  deleteListApi,
  addStationApi,
  removeStationApi,
  moveStationApi,
  exportListApi,
  importListApi,
} from '../lib/schedule';

export function useLists() {
  const [lists, setLists] = useState<StationList[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeListId, setActiveListId] = useState<string>('');

  const refresh = useCallback(async () => {
    try {
      const data = await fetchLists();
      setLists(data);
      // Set active list to first list if not already set
      setActiveListId(prev => {
        if (prev && data.some(l => l.id === prev)) return prev;
        return data.length > 0 ? data[0].id : '';
      });
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createList = useCallback(async (name: string): Promise<StationList | null> => {
    try {
      const list = await createListApi(name);
      await refresh();
      return list;
    } catch (err) {
      console.error('Failed to create list:', err);
      return null;
    }
  }, [refresh]);

  const renameList = useCallback(async (listId: string, name: string) => {
    try {
      await renameListApi(listId, name);
      await refresh();
    } catch (err) {
      console.error('Failed to rename list:', err);
    }
  }, [refresh]);

  const deleteList = useCallback(async (listId: string) => {
    try {
      await deleteListApi(listId);
      await refresh();
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  }, [refresh]);

  const addStation = useCallback(async (listId: string, broadcast: Broadcast, notes = '') => {
    try {
      await addStationApi(listId, {
        freq_khz: broadcast.freq_khz,
        freq_hz: broadcast.freq_hz,
        station: broadcast.station,
        language: broadcast.language,
        target: broadcast.target,
        demod_mode: broadcast.demod_mode,
        bandwidth: broadcast.bandwidth,
        notes,
      });
      await refresh();
    } catch (err) {
      console.error('Failed to add station:', err);
    }
  }, [refresh]);

  const removeStation = useCallback(async (listId: string, stationId: string) => {
    try {
      await removeStationApi(listId, stationId);
      await refresh();
    } catch (err) {
      console.error('Failed to remove station:', err);
    }
  }, [refresh]);

  const moveStation = useCallback(async (fromListId: string, stationId: string, targetListId: string) => {
    try {
      await moveStationApi(fromListId, stationId, targetListId);
      await refresh();
    } catch (err) {
      console.error('Failed to move station:', err);
    }
  }, [refresh]);

  const doExportList = useCallback(async (listId: string) => {
    try {
      const data = await exportListApi(listId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export list:', err);
    }
  }, []);

  const doImportList = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importListApi(data);
      await refresh();
    } catch (err) {
      console.error('Failed to import list:', err);
    }
  }, [refresh]);

  // Check if station is in any list (backward compat with isFavorite)
  const isInAnyList = useCallback((freq_khz: number, station: string): boolean => {
    return lists.some(l =>
      l.stations.some(s => s.freq_khz === freq_khz && s.station === station)
    );
  }, [lists]);

  // Find station across all lists
  const findStation = useCallback((freq_khz: number, station: string): { listId: string; stationId: string } | undefined => {
    for (const list of lists) {
      const s = list.stations.find(f => f.freq_khz === freq_khz && f.station === station);
      if (s) return { listId: list.id, stationId: s.id };
    }
    return undefined;
  }, [lists]);

  const activeList = lists.find(l => l.id === activeListId) || null;

  return {
    lists,
    loading,
    activeListId,
    activeList,
    setActiveListId,
    createList,
    renameList,
    deleteList,
    addStation,
    removeStation,
    moveStation,
    exportList: doExportList,
    importList: doImportList,
    isInAnyList,
    findStation,
    refresh,
  };
}
