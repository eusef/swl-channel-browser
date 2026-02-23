import { useState, useRef, useCallback, useEffect } from 'react';

/** Secure-context-safe ID generator (crypto.randomUUID requires HTTPS) */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Encode raw PCM Float32 samples into a WAV file blob.
 * Produces 16-bit PCM mono WAV at the given sample rate.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert Float32 [-1, 1] to Int16
  let offset = headerSize;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export interface Recording {
  id: string;
  filename: string;
  freq_khz: number;
  station: string;
  started_at: string;
  duration_seconds: number;
  blob: Blob;
  url: string;
}

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const metaRef = useRef<{ freq_khz: number; station: string; gainNode: GainNode } | null>(null);
  const recordingsRef = useRef<Recording[]>([]);

  // Keep ref in sync with state for cleanup
  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  const startRecording = useCallback((
    gainNode: GainNode,
    audioCtx: AudioContext,
    freq_khz: number,
    station: string,
  ) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      return; // already recording
    }

    // Create destination node and connect
    const dest = audioCtx.createMediaStreamDestination();
    destinationRef.current = dest;
    gainNode.connect(dest);

    // Pick best available codec
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(dest.stream, { mimeType });
    mediaRecorderRef.current = recorder;
    metaRef.current = { freq_khz, station, gainNode };

    // Collect chunks
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    // On stop, assemble recording
    recorder.onstop = () => {
      try {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const timestamp = new Date(startTimeRef.current).toISOString().replace(/[:.]/g, '-');
        const safeStation = station.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${freq_khz}kHz-${safeStation}-${timestamp}.webm`;

        const recording: Recording = {
          id: generateId(),
          filename,
          freq_khz,
          station,
          started_at: new Date(startTimeRef.current).toISOString(),
          duration_seconds: duration,
          blob,
          url,
        };
        setRecordings(prev => [recording, ...prev]);
      } catch (err) {
        console.error('[Recording] Failed to save recording:', err);
      }

      // Disconnect recording tap (leaves speaker connection intact)
      if (metaRef.current) {
        try {
          metaRef.current.gainNode.disconnect(dest);
        } catch {
          // already disconnected
        }
      }
      destinationRef.current = null;
      mediaRecorderRef.current = null;
      metaRef.current = null;
    };

    // Start
    startTimeRef.current = Date.now();
    recorder.start(1000); // 1s timeslice
    setIsRecording(true);
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const downloadRecording = useCallback((id: string) => {
    const rec = recordingsRef.current.find(r => r.id === id);
    if (!rec) return;
    const a = document.createElement('a');
    a.href = rec.url;
    a.download = rec.filename;
    a.click();
  }, []);

  const downloadAsWav = useCallback(async (id: string) => {
    const rec = recordingsRef.current.find(r => r.id === id);
    if (!rec) return;

    try {
      // Decode the WebM blob to raw PCM via Web Audio API
      const arrayBuffer = await rec.blob.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      audioCtx.close();

      // Get mono channel data
      const samples = audioBuffer.getChannelData(0);
      const wavBlob = encodeWav(samples, audioBuffer.sampleRate);

      // Trigger download with .wav extension
      const wavFilename = rec.filename.replace(/\.webm$/, '.wav');
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = wavFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Recording] WAV conversion failed:', err);
    }
  }, []);

  const removeRecording = useCallback((id: string) => {
    setRecordings(prev => {
      const rec = prev.find(r => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter(r => r.id !== id);
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      recordingsRef.current.forEach(r => URL.revokeObjectURL(r.url));
    };
  }, []);

  return {
    isRecording,
    elapsed,
    recordings,
    startRecording,
    stopRecording,
    downloadRecording,
    downloadAsWav,
    removeRecording,
  };
}
