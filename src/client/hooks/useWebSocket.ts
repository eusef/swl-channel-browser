import { useState, useEffect, useRef, useCallback } from 'react';
import { SDRConnectClient } from '../lib/sdrconnect';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export function useWebSocket(deviceSerial?: string) {
  const clientRef = useRef<SDRConnectClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [versionError, setVersionError] = useState(false);
  const deviceSerialRef = useRef(deviceSerial || '');

  // Keep the serial ref in sync so reconnects use the latest value
  useEffect(() => {
    deviceSerialRef.current = deviceSerial || '';
  }, [deviceSerial]);

  useEffect(() => {
    // Reuse existing client (handles StrictMode double-mount)
    if (clientRef.current) {
      return;
    }

    const client = new SDRConnectClient();
    clientRef.current = client;

    client.onConnectionChange((connected) => {
      setStatus(connected ? 'connected' : 'disconnected');
      if (connected) setVersionError(false);
    });

    client.onVersionError(() => {
      setVersionError(true);
    });

    setStatus('connecting');
    client.connect(deviceSerialRef.current);

    // Page lifecycle for mobile Safari bfcache
    const handlePageHide = () => {
      client.disconnect();
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setStatus('connecting');
        client.connect(deviceSerialRef.current);
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

  return { status, getClient, versionError };
}
