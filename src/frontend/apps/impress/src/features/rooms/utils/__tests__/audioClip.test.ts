import { describe, expect, it } from 'vitest';

import {
  DecodedAudio,
  OUTPUT_RATE,
  clampStart,
  encodeWav,
  extractWindow,
  peaks,
  windowLength,
} from '../audioClip';

const audio = (seconds: number, rate = 44100): DecodedAudio => {
  const length = Math.floor(seconds * rate);
  const data = new Float32Array(length).map((_, index) =>
    index < length / 2 ? 0.1 : 0.9,
  );
  return {
    sampleRate: rate,
    length,
    duration: seconds,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
};

describe('audioClip', () => {
  it('keeps at most 5 seconds, or the whole sound when it is shorter', () => {
    expect(windowLength(18)).toBe(5);
    expect(windowLength(3)).toBe(3);
  });

  it('keeps the window inside the sound', () => {
    expect(clampStart(-2, 18, 5)).toBe(0);
    expect(clampStart(16, 18, 5)).toBe(13);
    expect(clampStart(4, 18, 5)).toBe(4);
    expect(clampStart(1, 3, 3)).toBe(0);
  });

  it('draws one bar per slice with the loudest value of the slice', () => {
    const bars = peaks(audio(10), 4);
    expect(bars).toHaveLength(4);
    expect(bars[0]).toBeCloseTo(0.1);
    expect(bars[3]).toBeCloseTo(0.9);
  });

  it('cuts the window and brings it down to the output rate', () => {
    const samples = extractWindow(audio(20), 10, 5);
    expect(samples.length).toBe(5 * OUTPUT_RATE);
    // after the fade in, the loud second half of the sound
    expect(samples[Math.floor(samples.length / 2)]).toBeCloseTo(0.9, 1);
    // a short fade at each end
    expect(samples[0]).toBe(0);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.05);
  });

  it('writes a WAV that is 5 seconds long and well under 300 KB', async () => {
    const blob = encodeWav(extractWindow(audio(20), 0, 5));
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBeLessThan(300 * 1024);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(24, true)).toBe(OUTPUT_RATE);
    expect(view.getUint32(40, true) / 2 / OUTPUT_RATE).toBeCloseTo(5, 2);
  });
});
