import {
  LiveKitRoom,
  StartAudio,
  VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import '@livekit/components-styles/themes/default';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DisconnectReason } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';

import { KEY_ROOM_ACCESS, KEY_ROOM_PRESENCE, getRoomAccess } from '../api';

import { CHAT_WIDTH, useRoomChat } from '../stores/useRoomChat';

import { Reactions } from './Reactions';
import { Soundboard } from './Soundboard';
import { RoomChat } from './RoomChat';
import { RoomChatButton } from './RoomChatButton';

/**
 * The video room, open inside the page: the person is connected as soon as it is shown,
 * with the microphone and the camera off. The control bar turns them on, shares the
 * screen, or leaves the room.
 */
export const RoomStage = ({ roomId }: { roomId: string }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const chatOpen = useRoomChat((state) => state.open);
  const setChatOpen = useRoomChat((state) => state.setOpen);
  const stageRef = useRef<HTMLDivElement>(null);
  const retries = useRef(0);
  const stableTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // A token is made for one connection: never reused, never refreshed behind the scenes
  const access = useQuery({
    queryKey: [KEY_ROOM_ACCESS, roomId],
    queryFn: () => getRoomAccess(roomId),
    enabled: joined,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    setJoined(true);
  }, [roomId]);

  // The chat belongs to one room: it starts closed in each of them
  useEffect(() => {
    setChatOpen(false);
    return () => setChatOpen(false);
  }, [roomId, setChatOpen]);

  useEffect(() => {
    const onChange = () =>
      setFullscreen(
        !!stageRef.current && document.fullscreenElement === stageRef.current,
      );
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  /**
   * The names shown under the rooms follow the person at once: when a new token was
   * obtained the server has already taken them out of the room they were in, and when
   * they leave this one it must be shown without waiting for the next refresh.
   */
  const refreshPresence = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: [KEY_ROOM_PRESENCE] }),
    [queryClient],
  );
  useEffect(() => {
    if (access.data) {
      refreshPresence();
    }
  }, [access.dataUpdatedAt, access.data, refreshPresence]);
  useEffect(() => refreshPresence, [roomId, refreshPresence]);

  useEffect(() => {
    retries.current = 0;
    return () => {
      clearTimeout(stableTimer.current);
      clearTimeout(retryTimer.current);
    };
  }, [roomId]);

  const rejoin = useCallback(() => {
    queryClient.removeQueries({ queryKey: [KEY_ROOM_ACCESS, roomId] });
    setJoined(true);
    void access.refetch();
  }, [access, queryClient, roomId]);

  /**
   * A connection that drops for a technical reason (network hiccup, signal closed…)
   * is silently re-established with a new token. Only a deliberate removal from the
   * room, or too many failures in a row, is shown to the person.
   */
  const onDisconnected = (reason?: DisconnectReason) => {
    clearTimeout(stableTimer.current);
    refreshPresence();
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      return;
    }
    // helps to understand a disconnection nobody asked for
    console.warn(
      '[espaces] disconnected from the room:',
      reason === undefined ? 'unknown' : DisconnectReason[reason],
    );
    const final =
      reason === DisconnectReason.PARTICIPANT_REMOVED ||
      reason === DisconnectReason.DUPLICATE_IDENTITY ||
      reason === DisconnectReason.USER_REJECTED;
    if (final || retries.current >= MAX_SILENT_RETRIES) {
      setJoined(false);
      return;
    }
    retries.current += 1;
    const delay = Math.min(1000 * 2 ** (retries.current - 1), 8000);
    retryTimer.current = setTimeout(rejoin, delay);
  };

  // A connection that held for a while is healthy again: forget the failures
  const onConnected = () => {
    refreshPresence();
    clearTimeout(stableTimer.current);
    stableTimer.current = setTimeout(() => {
      retries.current = 0;
    }, 30000);
  };

  // In full screen the Chat button joins the other buttons of the control bar
  const [controlBar, setControlBar] = useState<Element | null>(null);
  useEffect(() => {
    if (!fullscreen || !stageRef.current) {
      setControlBar(null);
      return;
    }
    const stage = stageRef.current;
    const find = () => setControlBar(stage.querySelector('.lk-control-bar'));
    find();
    const observer = new MutationObserver(find);
    observer.observe(stage, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [fullscreen, joined, access.data]);

  const toggleFullscreen = (element: HTMLElement | null) => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element?.requestFullscreen?.();
    }
  };

  // "Enlarge" on a tile takes the whole screen instead of growing inside the room
  const onClickCapture = (event: React.MouseEvent) => {
    const toggle = (event.target as HTMLElement).closest(
      '.lk-focus-toggle-button',
    );
    if (!toggle) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    toggleFullscreen(toggle.closest<HTMLElement>('.lk-participant-tile'));
  };

  let content;
  if (!joined) {
    content = (
      <Message>
        <Text>
          {t('You were disconnected from the room.', {
            description: 'Shown when the video room closed the connection',
          })}
        </Text>
        <button type="button" onClick={rejoin} style={buttonStyle}>
          {t('Join', { description: 'Button to join a video room' })}
        </button>
      </Message>
    );
  } else if (access.isError) {
    content = (
      <Message>
        <Text>
          {t('This room cannot be joined.', {
            description: 'Error shown when the video room refuses the person',
          })}
        </Text>
        <button type="button" onClick={rejoin} style={buttonStyle}>
          {t('Try again', { description: 'Button to retry' })}
        </button>
      </Message>
    );
  } else if (!access.data) {
    content = (
      <Message>
        <Text $variation="secondary">
          {t('Connecting…', {
            description: 'Shown while the video room is being joined',
          })}
        </Text>
      </Message>
    );
  } else {
    content = (
      <LiveKitRoom
        key={`${roomId}-${access.dataUpdatedAt}`}
        serverUrl={access.data.url}
        token={access.data.token}
        connect
        audio={false}
        video={false}
        data-lk-theme="default"
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        connectOptions={{ maxRetries: 6, autoSubscribe: true }}
        options={{ adaptiveStream: true, dynacast: true }}
        style={{ height: '100%', width: '100%', display: 'flex' }}
      >
        <div className="room-video">
          <VideoConference />
          <Reactions />
          <Soundboard roomId={roomId} />
          <div className="room-start-audio">
            <StartAudio
              label={t('Click to enable the sound', {
                description: 'Button asked by the browser before playing sound',
              })}
            />
          </div>
        </div>
        <aside
          className="room-chat"
          data-testid="room-chat"
          data-open={chatOpen}
          aria-label={t('Chat', {
            description: 'Button opening the chat of the video room',
          })}
        >
          <div className="room-chat-header">
            <span>
              {t('Chat', {
                description: 'Button opening the chat of the video room',
              })}
            </span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label={t('Close the chat', {
                description: 'Button closing the chat column',
              })}
              title={t('Close the chat', {
                description: 'Button closing the chat column',
              })}
            >
              ✕
            </button>
          </div>
          <RoomChat />
        </aside>
      </LiveKitRoom>
    );
  }

  return (
    <Box
      ref={stageRef}
      data-testid="room-stage"
      onClickCapture={onClickCapture}
      $width="100%"
      $css={`
        position: relative;
        height: calc(100dvh - 300px);
        min-height: 480px;
        border-radius: 8px;
        overflow: hidden;
        [data-lk-theme] {
          --lk-font-family: var(--c--globals--font--families--base);
        }
        /* the toast of LiveKit is fixed to the window: keep it in the room */
        .lk-toast {
          position: absolute;
        }
        /* leaving the room is leaving the sub-space */
        .lk-disconnect-button {
          display: none;
        }
        &:fullscreen {
          height: 100vh;
          border-radius: 0;
          background: var(--lk-bg, #111);
        }
        /* the "enable the sound" button the browser asks for: a small button on the video */
        .room-start-audio {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 6;
        }
        .room-video {
          position: relative;
          flex: 1;
          min-width: 0;
          height: 100%;
        }
        /* the chat has its own button, outside of the control bar */
        .lk-chat-toggle {
          display: none;
        }
        .room-video .lk-chat {
          display: none;
        }
        /* the chat column: the whole height of the window, on the right of the page
           (it stays mounted when closed, so that no message is missed) */
        .room-chat {
          display: none;
          flex-direction: column;
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 900;
          width: min(${CHAT_WIDTH}px, 100vw);
          background: var(--lk-bg2, #1a1a1a);
          color: var(--lk-fg, #fff);
          border-left: 1px solid var(--lk-border-color, #333);
        }
        .room-chat[data-open='true'] {
          display: flex;
        }
        &:fullscreen .room-chat {
          position: static;
          height: 100%;
          flex-shrink: 0;
          z-index: auto;
        }
        .room-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          font-weight: 600;
          border-bottom: 1px solid var(--lk-border-color, #333);
        }
        .room-chat-header button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 1rem;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .room-chat-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .room-chat-messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          list-style: none;
          margin: 0;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .room-chat-meta {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 0.75rem;
          opacity: 0.7;
          margin-bottom: 2px;
        }
        .room-chat-line {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 4px;
        }
        .room-chat-bubble {
          border-radius: 14px;
          padding: 6px 12px;
          background: var(--lk-accent4, #2b2b4a);
          word-break: break-word;
          max-width: calc(100% - 32px);
        }
        .room-chat-entry[data-mine='true'] .room-chat-bubble {
          background: var(--lk-bg5, #3a3a3a);
        }
        .room-chat-add {
          opacity: 0;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 1rem;
          border-radius: 50%;
          width: 28px;
          height: 28px;
        }
        .room-chat-entry:hover .room-chat-add,
        .room-chat-add:focus-visible,
        .room-chat-add[aria-expanded='true'] {
          opacity: 1;
        }
        /* under the message, from its left edge: never cut by the column */
        .room-chat-picker {
          position: absolute;
          z-index: 2;
          top: calc(100% + 2px);
          left: 0;
          display: flex;
          gap: 2px;
          padding: 6px;
          border-radius: 10px;
          background: var(--lk-bg3, #2a2a2a);
          border: 1px solid var(--lk-border-color, #444);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .room-chat-picker button {
          border: 0;
          background: transparent;
          cursor: pointer;
          font-size: 1.25rem;
          padding: 4px;
          border-radius: 6px;
        }
        .room-chat-picker button:hover {
          background: var(--lk-control-hover-bg, #444);
        }
        .room-chat-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 4px;
        }
        .room-chat-chips button {
          border: 1px solid var(--lk-border-color, #444);
          background: transparent;
          color: inherit;
          border-radius: 12px;
          padding: 1px 8px;
          font-size: 0.8125rem;
          cursor: pointer;
        }
        .room-chat-chips button[data-on='true'] {
          background: var(--lk-accent4, #2b2b4a);
          border-color: #6a6af4;
        }
        .room-chat-form {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid var(--lk-border-color, #333);
        }
        .room-chat-form input {
          flex: 1;
          min-width: 0;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid var(--lk-border-color, #444);
          background: var(--lk-bg, #111);
          color: inherit;
          font: inherit;
        }
        .room-chat-form button {
          border: 0;
          border-radius: 6px;
          padding: 0 14px;
          background: #000091;
          color: #fff;
          font: inherit;
          cursor: pointer;
        }
        .room-chat-form button:disabled {
          opacity: 0.5;
          cursor: default;
        }
      `}
    >
      <button
        type="button"
        onClick={() => toggleFullscreen(stageRef.current)}
        aria-label={t('Full screen', {
          description: 'Button making the video room fill the screen',
        })}
        title={t('Full screen', {
          description: 'Button making the video room fill the screen',
        })}
        style={{
          position: 'absolute',
          top: 8,
          right: 8 + (fullscreen && chatOpen ? CHAT_WIDTH : 0),
          zIndex: 5,
          width: 32,
          height: 32,
          borderRadius: 6,
          border: 0,
          cursor: 'pointer',
          color: '#fff',
          background: 'rgba(0,0,0,0.55)',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ⛶
      </button>
      {content}
      {controlBar && createPortal(<RoomChatButton inControlBar />, controlBar)}
    </Box>
  );
};

const MAX_SILENT_RETRIES = 5;

const buttonStyle = {
  padding: '8px 16px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '1rem',
} as const;

const Message = ({ children }: { children: React.ReactNode }) => (
  <Box $flex={1} $align="center" $justify="center" $gap="sm">
    {children}
  </Box>
);
