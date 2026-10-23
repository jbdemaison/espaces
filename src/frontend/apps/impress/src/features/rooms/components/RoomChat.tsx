import {
  useChat,
  useDataChannel,
  useRoomContext,
} from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const TOPIC = 'chat-reaction';

/** Only friendly reactions are offered. */
export const CHAT_EMOJIS = ['👍', '❤️', '😂', '👏', '🎉', '🙏', '😍', '🔥'];

/** {message id: {emoji: identities of the people who reacted}} */
type Reactions = Record<string, Record<string, string[]>>;

const timeOf = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * The chat of the room: the messages, a field to write one, and for each message the
 * emoji reactions of the people present (a reaction can be taken back with a click).
 * Reactions travel on their own channel; like the messages, they are not kept.
 */
export const RoomChat = () => {
  const { t } = useTranslation();
  const room = useRoomContext();
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState('');
  const [reactions, setReactions] = useState<Reactions>({});
  const [picking, setPicking] = useState<string>();
  const listRef = useRef<HTMLUListElement>(null);

  const apply = useCallback(
    (messageId: string, emoji: string, who: string, on: boolean) =>
      setReactions((all) => {
        const current = all[messageId]?.[emoji] ?? [];
        const next = on
          ? current.includes(who)
            ? current
            : [...current, who]
          : current.filter((identity) => identity !== who);
        return {
          ...all,
          [messageId]: { ...all[messageId], [emoji]: next },
        };
      }),
    [],
  );

  const { send: sendData } = useDataChannel(TOPIC, (message) => {
    try {
      const { messageId, emoji, on } = JSON.parse(
        new TextDecoder().decode(message.payload),
      );
      const who = message.from?.identity;
      if (
        who &&
        typeof messageId === 'string' &&
        CHAT_EMOJIS.includes(emoji) &&
        typeof on === 'boolean'
      ) {
        apply(messageId, emoji, who, on);
      }
    } catch {
      // not a reaction: ignored
    }
  });

  const me = room.localParticipant.identity;

  const toggle = (messageId: string, emoji: string) => {
    const on = !(reactions[messageId]?.[emoji] ?? []).includes(me);
    apply(messageId, emoji, me, on);
    setPicking(undefined);
    void sendData(
      new TextEncoder().encode(JSON.stringify({ messageId, emoji, on })),
      { reliable: true },
    );
  };

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || isSending) {
      return;
    }
    setText('');
    void send(message);
  };

  return (
    <div className="room-chat-body">
      <ul
        ref={listRef}
        className="room-chat-messages"
        data-testid="room-chat-messages"
      >
        {chatMessages.map((entry) => {
          const mine = entry.from?.isLocal ?? false;
          const name = mine
            ? t('You', { description: 'Name shown under your own reaction' })
            : entry.from?.name || entry.from?.identity || '';
          const chips = Object.entries(reactions[entry.id] ?? {}).filter(
            ([, who]) => who.length > 0,
          );
          return (
            <li
              key={entry.id}
              className="room-chat-entry"
              data-mine={mine}
              data-testid={`chat-message-${entry.id}`}
            >
              <div className="room-chat-meta">
                <span>{name}</span>
                <span>{timeOf(entry.timestamp)}</span>
              </div>
              <div className="room-chat-line">
                <div className="room-chat-bubble">{entry.message}</div>
                <div className="room-chat-react">
                  <button
                    type="button"
                    className="room-chat-add"
                    aria-label={t('React to this message', {
                      description: 'Button adding an emoji to a chat message',
                    })}
                    title={t('React to this message', {
                      description: 'Button adding an emoji to a chat message',
                    })}
                    aria-expanded={picking === entry.id}
                    data-testid={`chat-react-${entry.id}`}
                    onClick={() =>
                      setPicking(picking === entry.id ? undefined : entry.id)
                    }
                  >
                    ☺
                  </button>
                  {picking === entry.id && (
                    <div
                      className="room-chat-picker"
                      role="menu"
                      ref={(element) =>
                        element?.scrollIntoView?.({ block: 'nearest' })
                      }
                    >
                      {CHAT_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          role="menuitem"
                          onClick={() => toggle(entry.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {chips.length > 0 && (
                <div className="room-chat-chips">
                  {chips.map(([emoji, who]) => (
                    <button
                      key={emoji}
                      type="button"
                      data-on={who.includes(me)}
                      data-testid={`chat-chip-${entry.id}-${emoji}`}
                      onClick={() => toggle(entry.id, emoji)}
                    >
                      {emoji} {who.length}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <form className="room-chat-form" onSubmit={submit}>
        <input
          type="text"
          value={text}
          data-testid="room-chat-input"
          aria-label={t('Write a message…', {
            description: 'Placeholder of the chat field',
          })}
          placeholder={t('Write a message…', {
            description: 'Placeholder of the chat field',
          })}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" disabled={!text.trim() || isSending}>
          {t('Send', { description: 'Button sending a chat message' })}
        </button>
      </form>
    </div>
  );
};
