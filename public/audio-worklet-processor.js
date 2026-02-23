/**
 * AudioWorklet processor for streaming PCM audio playback.
 * Runs on a dedicated audio thread — immune to main-thread jank.
 *
 * Features:
 * - Ring buffer for smooth continuous playback
 * - Pre-buffering to absorb network jitter
 * - Continuous fractional resampling for clock drift compensation:
 *   the playback rate varies smoothly based on buffer fill level,
 *   keeping the buffer stable indefinitely with zero audible artifacts.
 */
class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Ring buffer: ~2.7 seconds at 48kHz (must be power of 2)
    this.bufferSize = 131072;
    this.bufferMask = this.bufferSize - 1;
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = 0;        // integer part of read position
    this.readFrac = 0.0;     // fractional part for interpolation
    this.bufferedSamples = 0;

    // Pre-buffer ~340ms before starting playback
    this.preBuffering = true;
    this.preBufferSize = 16384;

    // Drift compensation: target buffer level
    this.targetLevel = 8192; // ~170ms

    this.port.onmessage = (e) => {
      if (e.data === 'reset') {
        this.writePos = 0;
        this.readPos = 0;
        this.readFrac = 0.0;
        this.bufferedSamples = 0;
        this.preBuffering = true;
        return;
      }

      const samples = e.data;
      const len = samples.length;

      for (let i = 0; i < len; i++) {
        this.ringBuffer[this.writePos] = samples[i];
        this.writePos = (this.writePos + 1) & this.bufferMask;
      }
      this.bufferedSamples += len;

      // Hard cap (safety net — drift comp should prevent this)
      if (this.bufferedSamples > this.bufferSize) {
        const overflow = this.bufferedSamples - this.bufferSize;
        this.readPos = (this.readPos + overflow) & this.bufferMask;
        this.bufferedSamples = this.bufferSize;
      }

      if (this.preBuffering && this.bufferedSamples >= this.preBufferSize) {
        this.preBuffering = false;
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0][0];
    if (!output) return true;
    const outLen = output.length; // 128

    if (this.preBuffering || this.bufferedSamples < 2) {
      output.fill(0);
      return true;
    }

    // Continuous drift compensation via variable playback rate.
    // error > 0 means buffer is overfull → speed up slightly (step > 1)
    // error < 0 means buffer is underfull → slow down slightly (step < 1)
    const error = this.bufferedSamples - this.targetLevel;

    // Gentle proportional control: ±1.2% drift → correction of ~0.012
    // Smoothing divisor of 200000 keeps adjustments imperceptible.
    // Clamp to ±5% to handle any reasonable clock mismatch.
    const correction = Math.max(-0.05, Math.min(0.05, error / 200000));
    const step = 1.0 + correction;

    // Fractional resampling with linear interpolation
    let frac = this.readFrac;
    let pos = this.readPos;
    let consumed = 0;

    for (let i = 0; i < outLen; i++) {
      // Safety: stop if we've consumed nearly all buffered data
      if (this.bufferedSamples - consumed < 2) {
        output.fill(0, i);
        break;
      }

      const idx0 = pos & this.bufferMask;
      const idx1 = (pos + 1) & this.bufferMask;

      // Linear interpolation between two adjacent samples
      output[i] = this.ringBuffer[idx0] * (1.0 - frac) + this.ringBuffer[idx1] * frac;

      // Advance fractional read position
      frac += step;
      const advance = Math.trunc(frac);
      frac -= advance;
      pos = (pos + advance) & this.bufferMask;
      consumed += advance;
    }

    this.readPos = pos;
    this.readFrac = frac;
    this.bufferedSamples -= consumed;

    return true;
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
