/** Longest sound that is kept, and longest file the person may start from. */
export const CLIP_SECONDS = 5;
export const SOURCE_MAX_SECONDS = 20;
/** A source file is read in memory: this keeps it reasonable. */
export const SOURCE_MAX_BYTES = 15 * 1024 * 1024;
/** Sound is stored as mono 16-bit WAV at this rate: 5 s weigh about 220 KB. */
export const OUTPUT_RATE = 22050;
const FADE_SECONDS = 0.01;

/** What is needed of a decoded sound: no more than `AudioBuffer` gives. */
export interface DecodedAudio {
  sampleRate: number;
  length: number;
  duration: number;
  numberOfChannels: number;
  getChannelData: (channel: number) => Float32Array;
}

/** Reads any audio file the browser knows (MP3, WAV, OGG, M4A…). Rejects when it cannot. */
export const decodeFile = async (file: File): Promise<DecodedAudio> => {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('no audio support');
  }
  const context = new AudioContextClass();
  try {
    return await context.decodeAudioData(await file.arrayBuffer());
  } finally {
    void context.close();
  }
};

/** The start of the window of `length` seconds, kept inside the sound. */
export const clampStart = (start: number, duration: number, length: number) =>
  Math.min(Math.max(0, start), Math.max(0, duration - length));

/** Length of the window that is kept: the whole sound if it is short. */
export const windowLength = (duration: number) =>
  Math.min(CLIP_SECONDS, duration);

/** One value (0..1) per bar for drawing the shape of the sound. */
export const peaks = (audio: DecodedAudio, bars: number): number[] => {
  const channel = audio.getChannelData(0);
  const size = Math.max(1, Math.floor(channel.length / bars));
  const result: number[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    let max = 0;
    const from = bar * size;
    for (
      let index = from;
      index < Math.min(from + size, channel.length);
      index += 1
    ) {
      max = Math.max(max, Math.abs(channel[index]));
    }
    result.push(Math.min(1, max));
  }
  return result;
};

/** Mono samples of the window, brought down to `OUTPUT_RATE`, with a short fade at each end. */
export const extractWindow = (
  audio: DecodedAudio,
  start: number,
  length: number,
): Float32Array => {
  const rate = audio.sampleRate;
  const from = Math.floor(start * rate);
  const to = Math.min(audio.length, Math.floor((start + length) * rate));
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
    audio.getChannelData(index),
  );
  const ratio = rate / OUTPUT_RATE;
  const count = Math.max(1, Math.floor((to - from) / ratio));
  const out = new Float32Array(new ArrayBuffer(count * 4));
  for (let index = 0; index < count; index += 1) {
    const begin = from + Math.floor(index * ratio);
    const end = Math.min(
      to,
      Math.max(begin + 1, from + Math.floor((index + 1) * ratio)),
    );
    let sum = 0;
    for (let sample = begin; sample < end; sample += 1) {
      for (const channel of channels) {
        sum += channel[sample];
      }
    }
    out[index] = sum / ((end - begin) * channels.length);
  }
  const fade = Math.min(
    Math.floor(FADE_SECONDS * OUTPUT_RATE),
    Math.floor(count / 2),
  );
  for (let index = 0; index < fade; index += 1) {
    const gain = index / fade;
    out[index] *= gain;
    out[count - 1 - index] *= gain;
  }
  return out;
};

/** A WAV file (16-bit PCM, mono) holding the samples. */
export const encodeWav = (samples: Float32Array, rate = OUTPUT_RATE): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      view.setUint8(offset + index, char.charCodeAt(0)),
    );
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(
      44 + index * 2,
      value < 0 ? value * 0x8000 : value * 0x7fff,
      true,
    );
  });
  return new Blob([buffer], { type: 'audio/wav' });
};
