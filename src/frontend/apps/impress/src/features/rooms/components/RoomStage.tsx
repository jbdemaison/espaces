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
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';

import { KEY_ROOM_ACCESS, getRoomAccess } from '../api';

import { Reactions } from './Reactions';

/**
 * The video room, open inside the page: the person is connected as soon as it is shown,
 * with the microphone and the camera off. The control bar turns them on, shares the
 * screen, or leaves the room.
 */
export const RoomStage = ({ roomId }: { roomId: string }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(true);
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
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      return;
    }
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
    clearTimeout(stableTimer.current);
    stableTimer.current = setTimeout(() => {
      retries.current = 0;
    }, 30000);
  };

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
        style={{ height: '100%', width: '100%' }}
      >
        <VideoConference />
        <Reactions />
        <StartAudio
          label={t('Click to enable the sound', {
            description: 'Button asked by the browser before playing sound',
          })}
        />
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
          right: 8,
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
