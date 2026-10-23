import { FormEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAddSound } from '../api/sounds';
import {
  CLIP_SECONDS,
  DecodedAudio,
  SOURCE_MAX_BYTES,
  SOURCE_MAX_SECONDS,
  clampStart,
  decodeFile,
  encodeWav,
  extractWindow,
  peaks,
  windowLength,
} from '../utils/audioClip';

/** Emojis to choose from: nobody types one. */
export const SOUND_EMOJIS = [
  '👏',
  '🎉',
  '😂',
  '🔥',
  '👍',
  '❤️',
  '😮',
  '🙌',
  '🥳',
  '😎',
  '🤔',
  '😅',
  '🚀',
  '💡',
  '✅',
  '⏰',
  '🔔',
  '🎵',
  '🥁',
  '🎺',
  '🤝',
  '💪',
  '🙏',
  '😴',
  '☕',
  '🍕',
  '🎯',
  '⭐',
];

const BARS = 80;
const FIELD_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  borderRadius: 6,
  font: 'inherit',
  color: '#161616',
  background: '#fff',
  border: '1px solid #ccc',
} as const;

/**
 * The form adding a sound to the space. The file may last up to 20 seconds: the
 * person picks the 5 seconds to keep, and only that part is sent.
 */
export const SoundAddForm = ({
  roomId,
  maxBytes,
  onClose,
}: {
  roomId: string;
  maxBytes: number;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const addSound = useAddSound(roomId);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(SOUND_EMOJIS[0]);
  const [audio, setAudio] = useState<DecodedAudio>();
  const [start, setStart] = useState(0);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<AudioBufferSourceNode | undefined>(undefined);
  const bars = useRef<number[]>([]);

  const length = audio ? windowLength(audio.duration) : CLIP_SECONDS;

  // the shape of the sound, with the kept part highlighted
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext?.('2d');
    if (!element || !context || !audio) {
      return;
    }
    const { width, height } = element;
    context.clearRect(0, 0, width, height);
    const from = (start / audio.duration) * width;
    const to = ((start + length) / audio.duration) * width;
    context.fillStyle = 'rgba(106, 106, 244, 0.35)';
    context.fillRect(from, 0, to - from, height);
    bars.current.forEach((value, index) => {
      const x = (index / BARS) * width;
      const inside = x >= from && x <= to;
      context.fillStyle = inside ? '#8585f6' : '#888';
      const h = Math.max(2, value * height);
      context.fillRect(x, (height - h) / 2, width / BARS - 1, h);
    });
  }, [audio, start, length]);

  const stopPreview = () => {
    try {
      preview.current?.stop();
    } catch {
      // already stopped
    }
    preview.current = undefined;
  };
  useEffect(() => stopPreview, []);

  const pick = async (file: File | undefined) => {
    setError('');
    setAudio(undefined);
    stopPreview();
    if (!file) {
      return;
    }
    if (file.size > SOURCE_MAX_BYTES) {
      setError(
        t('This file is too big.', {
          description: 'Error when adding a sound to a space',
        }),
      );
      return;
    }
    try {
      const decoded = await decodeFile(file);
      if (decoded.duration > SOURCE_MAX_SECONDS) {
        setError(
          t('This sound is too long (at most {{seconds}} seconds).', {
            seconds: SOURCE_MAX_SECONDS,
            description: 'Error when adding a sound to a space',
          }),
        );
        return;
      }
      bars.current = peaks(decoded, BARS);
      setStart(0);
      setAudio(decoded);
      if (!name) {
        setName(file.name.replace(/\.[^.]+$/, '').slice(0, 40));
      }
    } catch {
      setError(
        t('This file could not be read as a sound.', {
          description: 'Error when adding a sound to a space',
        }),
      );
    }
  };

  const moveTo = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!audio || (event.type === 'pointermove' && event.buttons !== 1)) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - box.left) / box.width) * audio.duration;
    setStart(clampStart(at - length / 2, audio.duration, length));
  };

  const listen = () => {
    if (!audio) {
      return;
    }
    stopPreview();
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const samples = extractWindow(audio, start, length);
    const clip = context.createBuffer(1, samples.length, 22050);
    clip.copyToChannel(new Float32Array(samples), 0);
    const source = context.createBufferSource();
    source.buffer = clip;
    source.connect(context.destination);
    source.onended = () => void context.close();
    source.start();
    preview.current = source;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!audio) {
      return;
    }
    setError('');
    setWaiting(true);
    try {
      const blob = encodeWav(extractWindow(audio, start, length));
      if (blob.size > maxBytes) {
        setError(
          t('This sound is too big (at most {{kb}} KB).', {
            kb: Math.round(maxBytes / 1024),
            description: 'Error when adding a sound to a space',
          }),
        );
        return;
      }
      await addSound.mutateAsync({
        name: name.trim(),
        emoji,
        file: new File([blob], 'sound.wav', { type: 'audio/wav' }),
      });
      onClose();
    } catch {
      setError(
        t('The sound could not be added.', {
          description: 'Error when adding a sound to a space',
        }),
      );
    } finally {
      setWaiting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)' }}
      data-testid="sound-add-form"
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={40}
        required
        placeholder={t('Name of the sound', {
          description: 'Field of the form adding a sound',
        })}
        aria-label={t('Name of the sound', {
          description: 'Field of the form adding a sound',
        })}
        style={FIELD_STYLE}
      />
      <div
        role="group"
        aria-label={t('Emoji of the sound', {
          description: 'Field of the form adding a sound',
        })}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
      >
        {SOUND_EMOJIS.map((item) => (
          <button
            key={item}
            type="button"
            className="lk-button"
            aria-pressed={emoji === item}
            aria-label={item}
            data-testid={`sound-emoji-${item}`}
            onClick={() => setEmoji(item)}
            style={{
              fontSize: '1.2rem',
              padding: '2px 6px',
              outline: emoji === item ? '2px solid #8585f6' : undefined,
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <input
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        onChange={(event) => void pick(event.target.files?.[0])}
        aria-label={t('Sound file', {
          description: 'Field of the form adding a sound',
        })}
        data-testid="sound-file"
        style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
      />
      <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: 0 }}>
        {t(
          'Up to {{max}} seconds: you then choose the {{clip}} seconds to keep.',
          {
            max: SOURCE_MAX_SECONDS,
            clip: CLIP_SECONDS,
            description: 'Hint of the form adding a sound',
          },
        )}
      </p>
      {audio && (
        <div data-testid="sound-clip" style={{ display: 'grid', gap: 6 }}>
          <canvas
            ref={canvas}
            width={400}
            height={60}
            onPointerDown={moveTo}
            onPointerMove={moveTo}
            aria-hidden="true"
            style={{
              width: '100%',
              height: 60,
              touchAction: 'none',
              cursor: 'pointer',
              background: '#2a2a2a',
              borderRadius: 6,
            }}
          />
          <input
            type="range"
            min={0}
            max={Math.max(0, audio.duration - length)}
            step={0.05}
            value={start}
            disabled={audio.duration <= length}
            onChange={(event) =>
              setStart(
                clampStart(Number(event.target.value), audio.duration, length),
              )
            }
            aria-label={t('Start of the part to keep', {
              description: 'Slider choosing where the kept part begins',
            })}
            data-testid="sound-start"
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
            }}
          >
            <span data-testid="sound-range">
              {t('From {{from}} s to {{to}} s', {
                from: start.toFixed(1),
                to: (start + length).toFixed(1),
                description: 'The part of the sound that is kept',
              })}
            </span>
            <button
              type="button"
              className="lk-button"
              onClick={listen}
              style={{ padding: '2px 8px' }}
            >
              {t('Listen', { description: 'Button playing the kept part' })}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" style={{ color: '#ff8a8a', margin: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="submit"
          className="lk-button"
          disabled={waiting || !audio || !name.trim()}
        >
          {t('Add', { description: 'Button adding a sound' })}
        </button>
        <button type="button" className="lk-button" onClick={onClose}>
          {t('Cancel', {
            description: 'Button to dismiss a dialog without confirming',
          })}
        </button>
      </div>
    </form>
  );
};
