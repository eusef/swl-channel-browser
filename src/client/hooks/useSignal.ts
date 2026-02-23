import { useState, useEffect } from 'react';
import { SDRConnectClient } from '../lib/sdrconnect';
import { ConnectionStatus } from './useWebSocket';

export function useSignal(getClient: () => SDRConnectClient | null, connectionStatus: ConnectionStatus) {
  const [power, setPower] = useState<number | null>(null);
  const [snr, setSnr] = useState<number | null>(null);

  useEffect(() => {
    const client = getClient();
    if (!client) return;

    const unsub = client.onSignalUpdate((p, s) => {
      if (!isNaN(p)) setPower(p);
      if (!isNaN(s)) setSnr(s);
    });

    return unsub;
  }, [getClient, connectionStatus]);

  return { power, snr };
}
