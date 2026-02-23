import { useState, useEffect, useRef, useCallback } from 'react';
import { SDRConnectClient } from '../lib/sdrconnect';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export function useWebSocket() {
  const clientRef = useRef<SDRConnectClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    // Reuse existing client (handles StrictMode double-mount)
    if (clientRef.current) {
      return;
    }

    const client = new SDRConnectClient();
    clientRef.current = client;

    client.onConnectionChange((connected) => {
      setStatus(connected ? 'connected' : 'disconnected');
    });

    setStatus('connecting');
    client.connect();

    // Page lifecycle for mobile Safari bfcache
    const handlePageHide = () => {
      client.disconnect();
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setStatus('connecting');
        client.connect();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      // Don't disconnect on cleanup — StrictMode will remount immediately.
      // The client persists in the ref and gets reused above.
    };
  }, []);

  // Clean up on true unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  const getClient = useCallback(() => clientRef.current, []);

  return { status, getClient };
}
