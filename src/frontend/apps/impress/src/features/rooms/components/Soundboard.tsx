import { useDataChannel } from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SpaceSound,
  isSoundId,
  soundUrl,
  useDeleteSound,
  useSpaceSounds,
} from '../api/sounds';
import { useSoundPrefs } from '../stores/useSoundPrefs';
import { SoundAddForm } from './SoundAddForm';

const TOPIC = 'sound';
const DEFAULT_EMOJI = '🔊';
/** nobody plays sounds faster than this, nor are they played faster for others */
const MIN_GAP_MS = 3000;
const MAX_PLAYING = 3;
/** a sound never plays longer than this, whatever the file holds */
const MAX_PLAY_MS = 6000;
const NOTICE_MS = 3500;

type Notice = { id: number; emoji: string; name: string; who: string };

/** the form adding a sound needs more room than the list of sounds */
const ADDING_WIDTH = 'min(440px, calc(100vw - 110px))';

const PANEL_STYLE = {
  position: 'absolute',
  right: 0,
  bottom: 52,
  width: 300,
  maxHeight: '60vh',
  overflowY: 'auto',
  overflowX: 'hidden',
  boxSizing: 'border-box',
  padding: 10,
  borderRadius: 12,
  color: 'var(--lk-fg, #fff)',
  background: 'var(--lk-bg2, #1e1e1e)',
  border: '1px solid var(--lk-border-color, #333)',
  boxShadow: 'var(--lk-box-shadow)',
} as const;

/**
 * The sounds of the space, played in the room: a click plays the sound here and
 * tells the others, whose browser plays it too. The sound travels from the server
 * once for each person; nothing goes through the microphone.
 */
export const Soundboard = ({ roomId }: { roomId: string }) => {
  const { t } = useTranslation();
  const sounds = useSpaceSounds(roomId);
  const deleteSound = useDeleteSound(roomId);
  const { volume, muted, setVolume, setMuted } = useSoundPrefs();

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  const playing = useRef(0);
  const lastLocal = useRef(0);
  const lastFrom = useRef(new Map<string, number>());
  const counter = useRef(0);
  const prefs = useRef({ volume, muted });
  prefs.current = { volume, muted };

  const announce = useCallback((sound: Omit<Notice, 'id'>) => {
    counter.current += 1;
    const id = counter.current;
    setNotices((list) => [...list.slice(-4), { id, ...sound }]);
    setTimeout(
      () => setNotices((list) => list.filter((item) => item.id !== id)),
      NOTICE_MS,
    );
  }, []);

  const play = useCallback(
    async (soundId: string) => {
      if (prefs.current.muted || playing.current >= MAX_PLAYING) {
        return;
      }
      playing.current += 1;
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          playing.current -= 1;
        }
      };
      try {
        const audio = new Audio(await soundUrl(roomId, soundId));
        audio.volume = prefs.current.volume;
        audio.onended = release;
        audio.onerror = release;
        setTimeout(() => {
          audio.pause();
          release();
        }, MAX_PLAY_MS);
        await audio.play();
      } catch {
        // the browser refused or the sound is gone: nothing to play
        release();
      }
    },
    [roomId],
  );

  const { send } = useDataChannel(TOPIC, (message) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(message.payload)) as {
        soundId?: unknown;
        name?: unknown;
        emoji?: unknown;
      };
      if (!isSoundId(data.soundId)) {
        return;
      }
      const who = message.from?.identity ?? '';
      const now = Date.now();
      if (now - (lastFrom.current.get(who) ?? 0) < MIN_GAP_MS - 500) {
        return;
      }
      lastFrom.current.set(who, now);
      announce({
        emoji:
          typeof data.emoji === 'string'
            ? data.emoji.slice(0, 16)
            : DEFAULT_EMOJI,
        name: typeof data.name === 'string' ? data.name.slice(0, 40) : '',
        who: message.from?.name || who,
      });
      void play(data.soundId);
    } catch {
      // not a sound: ignored
    }
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);

  const trigger = (sound: SpaceSound) => {
    const now = Date.now();
    if (now - lastLocal.current < MIN_GAP_MS) {
      return;
    }
    lastLocal.current = now;
    announce({
      emoji: sound.emoji,
      name: sound.name,
      who: t('You', { description: 'Name shown under your own reaction' }),
    });
    void play(sound.id);
    void send(
      new TextEncoder().encode(
        JSON.stringify({
          soundId: sound.id,
          name: sound.name,
          emoji: sound.emoji,
        }),
      ),
      { reliable: true },
    );
  };

  const label = t('Sounds', {
    description: 'Button opening the sounds of the space in the video room',
  });
  const list = sounds.data?.results ?? [];

  return (
    <>
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          left: 12,
          top: 48,
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          pointerEvents: 'none',
        }}
        data-testid="room-sound-notices"
      >
        {notices.map((item) => (
          <div
            key={item.id}
            style={{
              color: '#fff',
              fontSize: '0.9rem',
              background: 'rgba(0,0,0,0.65)',
              borderRadius: 16,
              padding: '4px 12px',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>{item.emoji}</span> {item.who}
            {item.name ? ` · ${item.name}` : ''}
          </div>
        ))}
      </div>
      <div
        style={{ position: 'absolute', right: 76, bottom: 12, zIndex: 6 }}
        data-testid="room-sounds"
      >
        {open && (
          <div
            role="dialog"
            aria-label={label}
            style={{
              ...PANEL_STYLE,
              width: adding ? ADDING_WIDTH : PANEL_STYLE.width,
            }}
          >
            {!adding && (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(volume * 100)}
                    onChange={(event) =>
                      setVolume(Number(event.target.value) / 100)
                    }
                    aria-label={t('Volume of the sounds', {
                      description:
                        'Slider of the volume of the sounds of the room',
                    })}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="lk-button"
                    aria-pressed={muted}
                    onClick={() => setMuted(!muted)}
                    title={t('Mute the sounds', {
                      description:
                        'Button muting the sounds played in the room',
                    })}
                    aria-label={t('Mute the sounds', {
                      description:
                        'Button muting the sounds played in the room',
                    })}
                  >
                    {muted ? '🔇' : '🔈'}
                  </button>
                </div>
                {sounds.isLoading && <p>…</p>}
                {!sounds.isLoading && list.length === 0 && (
                  <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                    {t('This space has no sound yet.', {
                      description: 'Shown when a space has no sound',
                    })}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {list.map((sound) => (
                    <span
                      key={sound.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        maxWidth: '100%',
                        minWidth: 0,
                      }}
                    >
                      <button
                        type="button"
                        className="lk-button"
                        onClick={() => trigger(sound)}
                        data-testid={`sound-${sound.id}`}
                        title={sound.name}
                        style={{ gap: 6, minWidth: 0, maxWidth: '100%' }}
                      >
                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>
                          {sound.emoji}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                          }}
                        >
                          {sound.name}
                        </span>
                      </button>
                      {sound.can_delete && (
                        <button
                          type="button"
                          className="lk-button"
                          onClick={() => deleteSound.mutate(sound.id)}
                          aria-label={t('Remove the sound {{name}}', {
                            name: sound.name,
                            description: 'Button removing a sound of the space',
                          })}
                          title={t('Remove', {
                            description: 'Button removing a sound of the space',
                          })}
                          style={{ padding: '4px 6px' }}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </>
            )}
            {sounds.data?.can_add && !adding && (
              <button
                type="button"
                className="lk-button"
                onClick={() => setAdding(true)}
                style={{ marginTop: 10 }}
                data-testid="sound-add-open"
              >
                {t('Add a sound', {
                  description: 'Button opening the form adding a sound',
                })}
              </button>
            )}
            {adding && (
              <SoundAddForm
                roomId={roomId}
                maxBytes={sounds.data?.max_bytes ?? 307200}
                onClose={() => setAdding(false)}
              />
            )}
          </div>
        )}
        <button
          type="button"
          className="lk-button"
          aria-label={label}
          title={label}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{ fontSize: '1.3rem' }}
          data-testid="room-sounds-button"
        >
          🔊
        </button>
      </div>
    </>
  );
};
