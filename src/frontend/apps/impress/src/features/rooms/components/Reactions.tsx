import { useDataChannel, useRoomContext } from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const TOPIC = 'reaction';
const EMOJIS = ['👍', '👏', '❤️', '😂', '😮', '🎉'];
const LIFETIME_MS = 3500;

type Floating = { id: number; emoji: string; name: string; left: number };

/**
 * Emoji reactions in the room: one click sends an emoji that floats up on the
 * screen of everybody connected.
 */
export const Reactions = () => {
  const { t } = useTranslation();
  const room = useRoomContext();
  const [open, setOpen] = useState(false);
  const [floating, setFloating] = useState<Floating[]>([]);
  const counter = useRef(0);

  const show = useCallback((emoji: string, name: string) => {
    counter.current += 1;
    const id = counter.current;
    const left = 8 + Math.random() * 40;
    setFloating((list) => [...list.slice(-15), { id, emoji, name, left }]);
    setTimeout(
      () => setFloating((list) => list.filter((item) => item.id !== id)),
      LIFETIME_MS,
    );
  }, []);

  const { send } = useDataChannel(TOPIC, (message) => {
    try {
      const { emoji } = JSON.parse(new TextDecoder().decode(message.payload));
      if (typeof emoji === 'string' && emoji.length <= 16) {
        show(emoji, message.from?.name || message.from?.identity || '');
      }
    } catch {
      // not a reaction: ignored
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

  const react = (emoji: string) => {
    setOpen(false);
    show(
      emoji,
      t('You', { description: 'Name shown under your own reaction' }),
    );
    void send(new TextEncoder().encode(JSON.stringify({ emoji })), {
      reliable: true,
    });
  };

  const label = t('React with an emoji', {
    description: 'Button opening the emoji reactions of the video room',
  });

  return (
    <>
      <style>{`
        @keyframes espaces-reaction-float {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          10% { opacity: 1; transform: translateY(-20px) scale(1); }
          100% { transform: translateY(-260px) scale(1.1); opacity: 0; }
        }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 80,
          width: '100%',
          height: 0,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        {floating.map((item) => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: `${item.left}%`,
              bottom: 0,
              textAlign: 'center',
              animation: `espaces-reaction-float ${LIFETIME_MS}ms ease-out forwards`,
            }}
          >
            <div style={{ fontSize: '2.2rem', lineHeight: 1 }}>
              {item.emoji}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: '#fff',
                background: 'rgba(0,0,0,0.55)',
                borderRadius: 8,
                padding: '1px 6px',
                marginTop: 2,
              }}
            >
              {item.name}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{ position: 'absolute', right: 16, bottom: 12, zIndex: 6 }}
        data-testid="room-reactions"
      >
        {open && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              right: 0,
              bottom: 52,
              display: 'flex',
              gap: 4,
              padding: 6,
              borderRadius: 12,
              background: 'var(--lk-bg2, #1e1e1e)',
              border: '1px solid var(--lk-border-color, #333)',
              boxShadow: 'var(--lk-box-shadow)',
            }}
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                aria-label={emoji}
                onClick={() => react(emoji)}
                className="lk-button"
                style={{ fontSize: '1.4rem', padding: '4px 8px' }}
              >
                {emoji}
              </button>
            ))}
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
        >
          🙂
        </button>
      </div>
    </>
  );
};
