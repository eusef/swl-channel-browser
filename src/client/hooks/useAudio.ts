import { useState, useRef, useCallback, useEffect } from 'react';
import { SDRConnectClient } from '../lib/sdrconnect';

const SAMPLE_RATE = 48000;

export function useAudio(getClient: () => SDRConnectClient | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const workletReady = useRef(false);
  const useWorklet = useRef(true); // false = fallback to ScriptProcessorNode

  // Ring buffer for ScriptProcessorNode fallback
  const fallbackBuffer = useRef<Float32Array | null>(null);
  const fallbackWritePos = useRef(0);
  const fallbackReadPos = useRef(0);
  const fallbackBuffered = useRef(0);

  const ensureAudioContext = useCallback(async () => {
    if (!audioCtxRef.current) {
      console.log('[SWL Audio] Creating AudioContext, sampleRate:', SAMPLE_RATE);
      audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.connect(audioCtxRef.current.destination);
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
    if (audioCtxRef.current.state === 'suspended') {
      console.log('[SWL Audio] Resuming suspended AudioContext...');
      await audioCtxRef.current.resume();
      console.log('[SWL Audio] AudioContext state:', audioCtxRef.current.state);
    }

    // Try loading AudioWorklet module once
    if (!workletReady.current && useWorklet.current) {
      try {
        await audioCtxRef.current.audioWorklet.addModule('/audio-worklet-processor.js');
        workletReady.current = true;
        console.log('[SWL Audio] AudioWorklet loaded successfully');
      } catch (err) {
        console.warn('[SWL Audio] AudioWorklet not supported, using ScriptProcessorNode fallback:', err);
        useWorklet.current = false;
      }
    }

    return audioCtxRef.current;
  }, [volume, isMuted]);

  const startAudio = useCallback(async () => {
    const client = getClient();
    if (!client) {
      console.warn('[SWL Audio] Cannot start: no WebSocket client');
      return;
    }
    if (!client.isConnected()) {
      console.warn('[SWL Audio] Cannot start: WebSocket not connected');
      return;
    }

    console.log('[SWL Audio] Starting audio...');

    try {
      const ctx = await ensureAudioContext();
      const gainNode = gainNodeRef.current!;

      // Diagnostics
      let frameCount = 0;
      let totalSamplesReceived = 0;
      let firstFrameTime = 0;
      let loggedDiag = false;

      if (useWorklet.current) {
        // === AudioWorklet path (preferred — runs on dedicated audio thread) ===
        console.log('[SWL Audio] Using AudioWorklet');
        const workletNode = new AudioWorkletNode(ctx, 'audio-stream-processor', {
          outputChannelCount: [1],
        });
        workletNode.connect(gainNode);
        workletNodeRef.current = workletNode;

        unsubRef.current = client.onAudioData((samples: Int16Array) => {
          if (frameCount === 0) {
            firstFrameTime = performance.now();
            console.log('[SWL Audio] First frame:', samples.length, 'Int16 samples');
          }
          frameCount++;
          totalSamplesReceived += samples.length;

          if (!loggedDiag && frameCount > 10) {
            const elapsed = (performance.now() - firstFrameTime) / 1000;
            if (elapsed >= 2) {
              console.log('[SWL Audio] Rate:', Math.round(totalSamplesReceived / elapsed), 'samples/s (stereo)');
              loggedDiag = true;
            }
          }

          // De-interleave stereo to mono
          const monoLength = Math.floor(samples.length / 2);
          const float32 = new Float32Array(monoLength);
          for (let i = 0; i < monoLength; i++) {
            float32[i] = samples[i * 2] / 32768;
          }
          workletNode.port.postMessage(float32, [float32.buffer]);
        });
      } else {
        // === ScriptProcessorNode fallback (iOS < 14.5, older browsers) ===
        console.log('[SWL Audio] Using ScriptProcessorNode fallback');
        const BUFFER_SIZE = 131072;
        const BUFFER_MASK = BUFFER_SIZE - 1;
        fallbackBuffer.current = new Float32Array(BUFFER_SIZE);
        fallbackWritePos.current = 0;
        fallbackReadPos.current = 0;
        fallbackBuffered.current = 0;
        let preBuffering = true;
        const PRE_BUFFER = 8192;

        const scriptNode = ctx.createScriptProcessor(4096, 0, 1);
        scriptNodeRef.current = scriptNode;

        scriptNode.onaudioprocess = (e) => {
          const output = e.outputBuffer.getChannelData(0);
          const buf = fallbackBuffer.current!;

          if (preBuffering) {
            if (fallbackBuffered.current >= PRE_BUFFER) {
              preBuffering = false;
            } else {
              output.fill(0);
              return;
            }
          }

          if (fallbackBuffered.current < output.length) {
            output.fill(0);
            return;
          }

          let rp = fallbackReadPos.current;
          for (let i = 0; i < output.length; i++) {
            output[i] = buf[rp];
            rp = (rp + 1) & BUFFER_MASK;
          }
          fallbackReadPos.current = rp;
          fallbackBuffered.current -= output.length;
        };

        scriptNode.connect(gainNode);

        unsubRef.current = client.onAudioData((samples: Int16Array) => {
          if (frameCount === 0) {
            firstFrameTime = performance.now();
            console.log('[SWL Audio] First frame (fallback):', samples.length, 'Int16 samples');
          }
          frameCount++;
          totalSamplesReceived += samples.length;

          if (!loggedDiag && frameCount > 10) {
            const elapsed = (performance.now() - firstFrameTime) / 1000;
            if (elapsed >= 2) {
              console.log('[SWL Audio] Rate:', Math.round(totalSamplesReceived / elapsed), 'samples/s');
              loggedDiag = true;
            }
          }

          const buf = fallbackBuffer.current!;
          const BUFFER_MASK = buf.length - 1;
          const monoLength = Math.floor(samples.length / 2);
          let wp = fallbackWritePos.current;
          for (let i = 0; i < monoLength; i++) {
            buf[wp] = samples[i * 2] / 32768;
            wp = (wp + 1) & BUFFER_MASK;
          }
          fallbackWritePos.current = wp;
          fallbackBuffered.current += monoLength;

          // Safety cap
          if (fallbackBuffered.current > buf.length) {
            fallbackBuffered.current = buf.length;
            fallbackReadPos.current = (fallbackWritePos.current - buf.length + buf.length) & BUFFER_MASK;
          }
        });
      }

      client.startAudio();
      setIsPlaying(true);
      console.log('[SWL Audio] Audio started successfully');
    } catch (err) {
      console.error('[SWL Audio] Failed to start audio:', err);
    }
  }, [getClient, ensureAudioContext]);

  const stopAudio = useCallback(() => {
    const client = getClient();
    if (client) {
      client.stopAudio();
    }
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage('reset');
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }
    setIsPlaying(false);
    console.log('[SWL Audio] Audio stopped');
  }, [getClient]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio().catch((err) => {
        console.error('[SWL Audio] togglePlay error:', err);
      });
    }
  }, [isPlaying, startAudio, stopAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = next ? 0 : volume;
      }
      return next;
    });
  }, [volume]);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    if (gainNodeRef.current && !isMuted) {
      gainNodeRef.current.gain.value = v;
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
      if (workletNodeRef.current) workletNodeRef.current.disconnect();
      if (scriptNodeRef.current) scriptNodeRef.current.disconnect();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  return {
    isPlaying,
    volume,
    isMuted,
    togglePlay,
    toggleMute,
    changeVolume,
    startAudio,
    stopAudio,
    getGainNode: () => gainNodeRef.current,
    getAudioContext: () => audioCtxRef.current,
  };
}
