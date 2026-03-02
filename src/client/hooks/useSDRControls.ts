import { useState, useEffect, useCallback, useRef } from 'react';
import { SDRConnectClient } from '../lib/sdrconnect';
import { ConnectionStatus } from './useWebSocket';

export interface SDRControlState {
  // Gain (Phase 1)
  lnaState: number;
  lnaMin: number;
  lnaMax: number;
  agcEnabled: boolean;
  agcThreshold: number;
  overload: boolean;
  // Audio (Phase 2)
  audioMute: boolean;
  audioLimiters: boolean;
  // Squelch (Phase 2)
  squelchEnable: boolean;
  squelchThreshold: number;
  // Noise reduction (Phase 2)
  nrEnable: boolean;
  nrStrength: number;
  // Spectrum display (Phase 2)
  spectrumRefLevel: number;
  spectrumBase: number;
  // Mode-specific filters (Phase 2)
  wfmStereoEnable: boolean;
  rdsEnable: boolean;
  nfmDeemphasisEnable: boolean;
  amLowcut: number;
  ssbLowcut: number;
  nfmLowcut: number;
}

/** Which controls the server confirmed as writable */
export interface SDRControlWritable {
  lna: boolean | null;
  agc: boolean | null;
  agcThreshold: boolean | null;
  audioMute: boolean | null;
  audioLimiters: boolean | null;
  squelchEnable: boolean | null;
  squelchThreshold: boolean | null;
  nrEnable: boolean | null;
  nrStrength: boolean | null;
  spectrumRefLevel: boolean | null;
  spectrumBase: boolean | null;
  wfmStereoEnable: boolean | null;
  rdsEnable: boolean | null;
  nfmDeemphasisEnable: boolean | null;
  amLowcut: boolean | null;
  ssbLowcut: boolean | null;
  nfmLowcut: boolean | null;
}

const DEFAULT_STATE: SDRControlState = {
  lnaState: 0,
  lnaMin: 0,
  lnaMax: 9,
  agcEnabled: true,
  agcThreshold: 50,
  overload: false,
  audioMute: false,
  audioLimiters: false,
  squelchEnable: false,
  squelchThreshold: -100,
  nrEnable: false,
  nrStrength: 5,
  spectrumRefLevel: 0,
  spectrumBase: -120,
  wfmStereoEnable: true,
  rdsEnable: true,
  nfmDeemphasisEnable: true,
  amLowcut: 20,
  ssbLowcut: 100,
  nfmLowcut: 300,
};

const DEFAULT_WRITABLE: SDRControlWritable = {
  lna: null, agc: null, agcThreshold: null,
  audioMute: null, audioLimiters: null,
  squelchEnable: null, squelchThreshold: null,
  nrEnable: null, nrStrength: null,
  spectrumRefLevel: null, spectrumBase: null,
  wfmStereoEnable: null, rdsEnable: null,
  nfmDeemphasisEnable: null,
  amLowcut: null, ssbLowcut: null, nfmLowcut: null,
};

/** Debounce interval for slider sends (ms) */
const SEND_DEBOUNCE_MS = 150;

/** How long to wait for a get_property response to verify a write (ms) */
const VERIFY_DELAY_MS = 500;

/** If no get_property_response arrives within this window after sending the
 *  verification request, assume the property is not writable (SDRconnect GUI
 *  mode silently ignores get_property for some controls). */
const VERIFY_TIMEOUT_MS = 1500;

/** Map SDR property names to writable keys */
const PROP_TO_WRITABLE: Record<string, keyof SDRControlWritable> = {
  lna_state: 'lna',
  agc_enable: 'agc',
  agc_threshold: 'agcThreshold',
  audio_mute: 'audioMute',
  audio_limiters: 'audioLimiters',
  squelch_enable: 'squelchEnable',
  squelch_threshold: 'squelchThreshold',
  noise_reduction_enable: 'nrEnable',
  noise_reduction_strength: 'nrStrength',
  spectrum_ref_level: 'spectrumRefLevel',
  spectrum_base: 'spectrumBase',
  wfm_stereo_enable: 'wfmStereoEnable',
  rds_enable: 'rdsEnable',
  nfm_deemphasis_enable: 'nfmDeemphasisEnable',
  am_lowcut_frequency: 'amLowcut',
  ssb_lowcut_frequency: 'ssbLowcut',
  nfm_lowcut_frequency: 'nfmLowcut',
};

const parseBool = (v: string) => v === 'true' || v === '1';
const parseNum = (v: string, fallback: number) => {
  const n = parseInt(v);
  return isNaN(n) ? fallback : n;
};

export function useSDRControls(
  getClient: () => SDRConnectClient | null,
  status: ConnectionStatus,
) {
  const [state, setState] = useState<SDRControlState>(DEFAULT_STATE);
  const [writable, setWritable] = useState<SDRControlWritable>({ ...DEFAULT_WRITABLE });
  const sendTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const verifyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const noResponseTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingVerify = useRef<Record<string, string>>({});
  const writableRef = useRef<SDRControlWritable>({ ...DEFAULT_WRITABLE });

  const writableKey = (prop: string): keyof SDRControlWritable | null =>
    PROP_TO_WRITABLE[prop] ?? null;

  // Debounced send + verify
  const debouncedSet = useCallback((property: string, value: string) => {
    const client = getClient();
    if (!client) return;

    if (sendTimers.current[property]) clearTimeout(sendTimers.current[property]);
    if (verifyTimers.current[property]) clearTimeout(verifyTimers.current[property]);
    if (noResponseTimers.current[property]) clearTimeout(noResponseTimers.current[property]);

    const wKey = writableKey(property);
    const alreadyConfirmed = wKey && writableRef.current[wKey] === true;

    sendTimers.current[property] = setTimeout(() => {
      client.setProperty(property, value);
      delete sendTimers.current[property];

      if (alreadyConfirmed) return;

      pendingVerify.current[property] = value;

      verifyTimers.current[property] = setTimeout(() => {
        client.getProperty(property);
        delete verifyTimers.current[property];

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

    const resetWritable = { ...DEFAULT_WRITABLE };
    setWritable(resetWritable);
    writableRef.current = resetWritable;

    // Seed from any properties already captured
    const seed = (prop: string): string | undefined => client.getPropertyValue(prop);

    setState(prev => {
      const next = { ...prev };
      // Gain
      const lna = seed('lna_state');
      if (lna !== undefined) next.lnaState = parseNum(lna, 0);
      const lnaMin = seed('lna_state_min');
      if (lnaMin !== undefined) next.lnaMin = parseNum(lnaMin, 0);
      const lnaMax = seed('lna_state_max');
      if (lnaMax !== undefined) next.lnaMax = parseNum(lnaMax, 9);
      const agc = seed('agc_enable');
      if (agc !== undefined) next.agcEnabled = parseBool(agc);
      const agcThr = seed('agc_threshold');
      if (agcThr !== undefined) next.agcThreshold = parseNum(agcThr, 50);
      const overload = seed('overload');
      if (overload !== undefined) next.overload = parseBool(overload);
      // Audio
      const mute = seed('audio_mute');
      if (mute !== undefined) next.audioMute = parseBool(mute);
      const limiters = seed('audio_limiters');
      if (limiters !== undefined) next.audioLimiters = parseBool(limiters);
      // Squelch
      const sqEn = seed('squelch_enable');
      if (sqEn !== undefined) next.squelchEnable = parseBool(sqEn);
      const sqThr = seed('squelch_threshold');
      if (sqThr !== undefined) next.squelchThreshold = parseNum(sqThr, -100);
      // NR
      const nrEn = seed('noise_reduction_enable');
      if (nrEn !== undefined) next.nrEnable = parseBool(nrEn);
      const nrStr = seed('noise_reduction_strength');
      if (nrStr !== undefined) next.nrStrength = parseNum(nrStr, 5);
      // Spectrum
      const refLvl = seed('spectrum_ref_level');
      if (refLvl !== undefined) next.spectrumRefLevel = parseNum(refLvl, 0);
      const base = seed('spectrum_base');
      if (base !== undefined) next.spectrumBase = parseNum(base, -120);
      // Mode-specific
      const wfmStereo = seed('wfm_stereo_enable');
      if (wfmStereo !== undefined) next.wfmStereoEnable = parseBool(wfmStereo);
      const rds = seed('rds_enable');
      if (rds !== undefined) next.rdsEnable = parseBool(rds);
      const nfmDe = seed('nfm_deemphasis_enable');
      if (nfmDe !== undefined) next.nfmDeemphasisEnable = parseBool(nfmDe);
      const amLc = seed('am_lowcut_frequency');
      if (amLc !== undefined) next.amLowcut = parseNum(amLc, 20);
      const ssbLc = seed('ssb_lowcut_frequency');
      if (ssbLc !== undefined) next.ssbLowcut = parseNum(ssbLc, 100);
      const nfmLc = seed('nfm_lowcut_frequency');
      if (nfmLc !== undefined) next.nfmLowcut = parseNum(nfmLc, 300);
      return next;
    });

    const unsub = client.onPropertyChange((prop, value, eventType) => {
      const wKey = writableKey(prop);
      if (wKey && eventType === 'get_property_response' && pendingVerify.current[prop] !== undefined) {
        delete pendingVerify.current[prop];
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
          // Gain
          case 'lna_state': return { ...prev, lnaState: parseNum(value, 0) };
          case 'lna_state_min': return { ...prev, lnaMin: parseNum(value, 0) };
          case 'lna_state_max': return { ...prev, lnaMax: parseNum(value, 9) };
          case 'agc_enable': return { ...prev, agcEnabled: parseBool(value) };
          case 'agc_threshold': return { ...prev, agcThreshold: parseNum(value, 50) };
          case 'overload': return { ...prev, overload: parseBool(value) };
          // Audio
          case 'audio_mute': return { ...prev, audioMute: parseBool(value) };
          case 'audio_limiters': return { ...prev, audioLimiters: parseBool(value) };
          // Squelch
          case 'squelch_enable': return { ...prev, squelchEnable: parseBool(value) };
          case 'squelch_threshold': return { ...prev, squelchThreshold: parseNum(value, -100) };
          // NR
          case 'noise_reduction_enable': return { ...prev, nrEnable: parseBool(value) };
          case 'noise_reduction_strength': return { ...prev, nrStrength: parseNum(value, 5) };
          // Spectrum
          case 'spectrum_ref_level': return { ...prev, spectrumRefLevel: parseNum(value, 0) };
          case 'spectrum_base': return { ...prev, spectrumBase: parseNum(value, -120) };
          // Mode-specific
          case 'wfm_stereo_enable': return { ...prev, wfmStereoEnable: parseBool(value) };
          case 'rds_enable': return { ...prev, rdsEnable: parseBool(value) };
          case 'nfm_deemphasis_enable': return { ...prev, nfmDeemphasisEnable: parseBool(value) };
          case 'am_lowcut_frequency': return { ...prev, amLowcut: parseNum(value, 20) };
          case 'ssb_lowcut_frequency': return { ...prev, ssbLowcut: parseNum(value, 100) };
          case 'nfm_lowcut_frequency': return { ...prev, nfmLowcut: parseNum(value, 300) };
          default: return prev;
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

  // --- Setters ---

  // Gain (Phase 1)
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

  // Audio (Phase 2)
  const setAudioMute = useCallback((muted: boolean) => {
    setState(prev => ({ ...prev, audioMute: muted }));
    debouncedSet('audio_mute', muted ? 'true' : 'false');
  }, [debouncedSet]);

  const setAudioLimiters = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, audioLimiters: enabled }));
    debouncedSet('audio_limiters', enabled ? 'true' : 'false');
  }, [debouncedSet]);

  // Squelch (Phase 2)
  const setSquelchEnable = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, squelchEnable: enabled }));
    debouncedSet('squelch_enable', enabled ? 'true' : 'false');
  }, [debouncedSet]);

  const setSquelchThreshold = useCallback((val: number) => {
    setState(prev => ({ ...prev, squelchThreshold: val }));
    debouncedSet('squelch_threshold', String(val));
  }, [debouncedSet]);

  // Noise reduction (Phase 2)
  const setNREnable = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, nrEnable: enabled }));
    debouncedSet('noise_reduction_enable', enabled ? 'true' : 'false');
  }, [debouncedSet]);

  const setNRStrength = useCallback((val: number) => {
    setState(prev => ({ ...prev, nrStrength: val }));
    debouncedSet('noise_reduction_strength', String(val));
  }, [debouncedSet]);

  // Spectrum display (Phase 2)
  const setSpectrumRefLevel = useCallback((val: number) => {
    setState(prev => ({ ...prev, spectrumRefLevel: val }));
    debouncedSet('spectrum_ref_level', String(val));
  }, [debouncedSet]);

  const setSpectrumBase = useCallback((val: number) => {
    setState(prev => ({ ...prev, spectrumBase: val }));
    debouncedSet('spectrum_base', String(val));
  }, [debouncedSet]);

  // Mode-specific filters (Phase 2)
  const setWfmStereoEnable = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, wfmStereoEnable: enabled }));
    debouncedSet('wfm_stereo_enable', enabled ? 'true' : 'false');
  }, [debouncedSet]);

  const setRdsEnable = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, rdsEnable: enabled }));
    debouncedSet('rds_enable', enabled ? 'true' : 'false');
  }, [debouncedSet]);

  const setNfmDeemphasisEnable = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, nfmDeemphasisEnable: enabled }));
    debouncedSet('nfm_deemphasis_enable', enabled ? 'true' : 'false');
  }, [debouncedSet]);

  const setAmLowcut = useCallback((val: number) => {
    setState(prev => ({ ...prev, amLowcut: val }));
    debouncedSet('am_lowcut_frequency', String(val));
  }, [debouncedSet]);

  const setSsbLowcut = useCallback((val: number) => {
    setState(prev => ({ ...prev, ssbLowcut: val }));
    debouncedSet('ssb_lowcut_frequency', String(val));
  }, [debouncedSet]);

  const setNfmLowcut = useCallback((val: number) => {
    setState(prev => ({ ...prev, nfmLowcut: val }));
    debouncedSet('nfm_lowcut_frequency', String(val));
  }, [debouncedSet]);

  return {
    ...state,
    writable,
    // Gain
    setLNA, setAGC, setAGCThreshold,
    // Audio
    setAudioMute, setAudioLimiters,
    // Squelch
    setSquelchEnable, setSquelchThreshold,
    // NR
    setNREnable, setNRStrength,
    // Spectrum
    setSpectrumRefLevel, setSpectrumBase,
    // Mode filters
    setWfmStereoEnable, setRdsEnable, setNfmDeemphasisEnable,
    setAmLowcut, setSsbLowcut, setNfmLowcut,
  };
}
