import { useState, useEffect, useCallback, useRef } from 'react';
import { SDRConnectClient } from '../lib/sdrconnect';
import { ConnectionStatus } from './useWebSocket';

export interface SDRControlState {
  lnaState: number;
  lnaMin: number;
  lnaMax: number;
  agcEnabled: boolean;
  agcThreshold: number;
  overload: boolean;
}

/** Which controls the server confirmed as writable */
export interface SDRControlWritable {
  lna: boolean | null;       // null = not yet tested
  agc: boolean | null;
  agcThreshold: boolean | null;
}

const DEFAULT_STATE: SDRControlState = {
  lnaState: 0,
  lnaMin: 0,
  lnaMax: 9,
  agcEnabled: true,
  agcThreshold: 50,
  overload: false,
};

/** Debounce interval for slider sends (ms) */
const SEND_DEBOUNCE_MS = 150;

/** How long to wait for a get_property response to verify a write (ms) */
const VERIFY_DELAY_MS = 500;

/** If no get_property_response arrives within this window after sending the
 *  verification request, assume the property is not writable (SDRconnect GUI
 *  mode silently ignores get_property for some controls). */
const VERIFY_TIMEOUT_MS = 1500;

export function useSDRControls(
  getClient: () => SDRConnectClient | null,
  status: ConnectionStatus,
) {
  const [state, setState] = useState<SDRControlState>(DEFAULT_STATE);
  const [writable, setWritable] = useState<SDRControlWritable>({
    lna: null, agc: null, agcThreshold: null,
  });
  const sendTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const verifyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const noResponseTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Tracks the value we sent, so we can compare with the server response */
  const pendingVerify = useRef<Record<string, string>>({});
  /** Mirror of writable state accessible inside callbacks without stale closures */
  const writableRef = useRef<SDRControlWritable>({ lna: null, agc: null, agcThreshold: null });

  // Map from SDR property name to writable key
  const writableKey = (prop: string): keyof SDRControlWritable | null => {
    switch (prop) {
      case 'lna_state': return 'lna';
      case 'agc_enable': return 'agc';
      case 'agc_threshold': return 'agcThreshold';
      default: return null;
    }
  };

  // Debounced send + verify: updates UI immediately, debounces the WebSocket
  // send, then issues a get_property to confirm the server accepted the change.
  const debouncedSet = useCallback((property: string, value: string) => {
    const client = getClient();
    if (!client) return;

    // Clear any pending send/verify/timeout for this property
    if (sendTimers.current[property]) clearTimeout(sendTimers.current[property]);
    if (verifyTimers.current[property]) clearTimeout(verifyTimers.current[property]);
    if (noResponseTimers.current[property]) clearTimeout(noResponseTimers.current[property]);

    // Once a control is confirmed writable, skip verification on future writes.
    // Re-verifying on every slider drag creates race conditions where stale
    // get_property_response values cause false read-only detection.
    const wKey = writableKey(property);
    const alreadyConfirmed = wKey && writableRef.current[wKey] === true;

    sendTimers.current[property] = setTimeout(() => {
      client.setProperty(property, value);
      delete sendTimers.current[property];

      if (alreadyConfirmed) return;

      // Store what we sent so we can compare later
      pendingVerify.current[property] = value;

      // After a short delay, ask the server for the current value
      verifyTimers.current[property] = setTimeout(() => {
        client.getProperty(property);
        delete verifyTimers.current[property];

        // If no response arrives at all (GUI mode ignores some properties),
        // mark the control as non-writable after a timeout.
        if (wKey) {
          noResponseTimers.current[property] = setTimeout(() => {
            if (pendingVerify.current[property] !== undefined) {
              delete pendingVerify.current[property];
              console.log(`[SDR] ${property} no response to get_property, marking read-only`);
              setWritable(prev => {
                const next = { ...prev, [wKey]: false };
                writableRef.current = next;
                return next;
              });
            }
            delete noResponseTimers.current[property];
          }, VERIFY_TIMEOUT_MS);
        }
      }, VERIFY_DELAY_MS);
    }, SEND_DEBOUNCE_MS);
  }, [getClient]);

  // Subscribe to property changes from the SDR
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    // Reset writable state on new connection
    const resetWritable = { lna: null, agc: null, agcThreshold: null } as SDRControlWritable;
    setWritable(resetWritable);
    writableRef.current = resetWritable;

    // Seed from any properties already captured
    const seed = (prop: string): string | undefined => client.getPropertyValue(prop);

    setState(prev => {
      const next = { ...prev };
      const lna = seed('lna_state');
      if (lna !== undefined) next.lnaState = parseInt(lna) || 0;
      const lnaMin = seed('lna_state_min');
      if (lnaMin !== undefined) next.lnaMin = parseInt(lnaMin) || 0;
      const lnaMax = seed('lna_state_max');
      if (lnaMax !== undefined) next.lnaMax = parseInt(lnaMax) || 9;
      const agc = seed('agc_enable');
      if (agc !== undefined) next.agcEnabled = agc === 'true' || agc === '1';
      const agcThr = seed('agc_threshold');
      if (agcThr !== undefined) next.agcThreshold = parseInt(agcThr) || 50;
      const overload = seed('overload');
      if (overload !== undefined) next.overload = overload === 'true' || overload === '1';
      return next;
    });

    const unsub = client.onPropertyChange((prop, value, eventType) => {
      // Only verify writes against get_property_response (our explicit query).
      // property_changed events are spontaneous pushes that may carry stale
      // values during rapid slider movement, causing false read-only detection.
      const wKey = writableKey(prop);
      if (wKey && eventType === 'get_property_response' && pendingVerify.current[prop] !== undefined) {
        delete pendingVerify.current[prop];
        // Cancel the no-response timeout since we got a reply.
        // Any get_property_response at all means the property is supported.
        // We don't compare values because SDRconnect may legitimately adjust
        // them (e.g. AGC threshold gets clamped by the AGC algorithm).
        if (noResponseTimers.current[prop]) {
          clearTimeout(noResponseTimers.current[prop]);
          delete noResponseTimers.current[prop];
        }
        setWritable(prev => {
          const next = { ...prev, [wKey]: true };
          writableRef.current = next;
          return next;
        });
      }

      setState(prev => {
        switch (prop) {
          case 'lna_state':
            return { ...prev, lnaState: parseInt(value) || 0 };
          case 'lna_state_min':
            return { ...prev, lnaMin: parseInt(value) || 0 };
          case 'lna_state_max':
            return { ...prev, lnaMax: parseInt(value) || 9 };
          case 'agc_enable':
            return { ...prev, agcEnabled: value === 'true' || value === '1' };
          case 'agc_threshold':
            return { ...prev, agcThreshold: parseInt(value) || 50 };
          case 'overload':
            return { ...prev, overload: value === 'true' || value === '1' };
          default:
            return prev;
        }
      });
    });

    return unsub;
  }, [getClient, status]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(sendTimers.current).forEach(clearTimeout);
      Object.values(verifyTimers.current).forEach(clearTimeout);
      Object.values(noResponseTimers.current).forEach(clearTimeout);
    };
  }, []);

  const setLNA = useCallback((val: number) => {
    setState(prev => ({ ...prev, lnaState: val }));
    debouncedSet('lna_state', String(val));
  }, [debouncedSet]);

  const setAGC = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, agcEnabled: enabled }));
    debouncedSet('agc_enable', enabled ? 'true' : 'false');
  }, [debouncedSet]);

  const setAGCThreshold = useCallback((val: number) => {
    setState(prev => ({ ...prev, agcThreshold: val }));
    debouncedSet('agc_threshold', String(val));
  }, [debouncedSet]);

  return {
    ...state,
    writable,
    setLNA,
    setAGC,
    setAGCThreshold,
  };
}
