import { useState, useEffect, useCallback } from 'react';
import { Favorite, Broadcast } from '../../shared/types';
import { fetchFavorites, addFavoriteApi, removeFavoriteApi } from '../lib/schedule';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const favs = await fetchFavorites();
      setFavorites(favs);
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (broadcast: Broadcast, notes = '') => {
    try {
      await addFavoriteApi({
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
      console.error('Failed to add favorite:', err);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    try {
      await removeFavoriteApi(id);
      await refresh();
    } catch (err) {
      console.error('Failed to remove favorite:', err);
    }
  }, [refresh]);

  const isFavorite = useCallback((freq_khz: number, station: string): boolean => {
    return favorites.some(f => f.freq_khz === freq_khz && f.station === station);
  }, [favorites]);

  const getFavoriteId = useCallback((freq_khz: number, station: string): string | undefined => {
    return favorites.find(f => f.freq_khz === freq_khz && f.station === station)?.id;
  }, [favorites]);

  return { favorites, loading, add, remove, isFavorite, getFavoriteId, refresh };
}
