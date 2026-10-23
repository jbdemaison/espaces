import { useQueryClient } from '@tanstack/react-query';
import { Room, RoomEvent } from 'livekit-client';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth';

import {
  KEY_ROOM_PRESENCE,
  getInboxAccess,
  markInboxReady,
  useMyStatus,
} from '../api';
import { useInvitations } from '../stores/useInvitations';
import { IncomingInvitation } from '../types';

const FIRST_DELAY_MS = 2000;
const MAX_DELAY_MS = 30000;
/** How often the page confirms that its inbox works. */
const HEARTBEAT_MS = 25_000;
/** An invitation is valid for a minute from the moment it arrives. */
const INVITATION_LIFETIME_MS = 60_000;

/** What the server pushes to the inbox, if it is an invitation. */
const parseInvitation = (payload: Uint8Array): IncomingInvitation | null => {
  try {
    const message = JSON.parse(new TextDecoder().decode(payload)) as Omit<
      IncomingInvitation,
      'deadline' | 'message'
    > & { type?: string; message?: unknown };
    if (message.type !== 'invitation' || !message.id || !message.room) {
      return null;
    }
    return {
      id: message.id,
      from: message.from,
      room: message.room,
      space: message.space,
      message:
        typeof message.message === 'string'
          ? message.message.slice(0, 140)
          : undefined,
      deadline: Date.now() + INVITATION_LIFETIME_MS,
    };
  } catch {
    return null;
  }
};

/**
 * While the person accepts to be invited ("reachable"), the page stays connected to their personal inbox
 * room, without sound or video. The connection is what makes them appear as
 * reachable in their favorite sub-spaces (it ends with the browser, and so does
 * their presence), and what invitations will be sent through.
 *
 * It renders nothing.
 */
export const ReachableChannel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: status } = useMyStatus(!!user);
  const active = !!user && !!status?.reachable;

  useEffect(() => {
    if (!active) {
      return;
    }

    let stopped = false;
    let room: Room | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = FIRST_DELAY_MS;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const refreshPresence = () =>
      void queryClient.invalidateQueries({ queryKey: [KEY_ROOM_PRESENCE] });

    const retry = () => {
      if (stopped) {
        return;
      }
      timer = setTimeout(() => void connect(), delay);
      delay = Math.min(delay * 2, MAX_DELAY_MS);
    };

    const connect = async () => {
      try {
        const access = await getInboxAccess();
        if (stopped) {
          return;
        }
        const next = new Room();
        room = next;
        next.on(RoomEvent.DataReceived, (payload) => {
          const invitation = parseInvitation(payload);
          console.warn('[espaces] inbox message received', !!invitation);
          if (invitation) {
            useInvitations.getState().receive(invitation);
          }
        });
        next.on('disconnected', (reason) => {
          console.warn('[espaces] inbox disconnected, reason:', reason);
          clearInterval(heartbeat);
          refreshPresence();
          retry();
        });
        await next.connect(access.url, access.token, { autoSubscribe: false });
        delay = FIRST_DELAY_MS;
        console.warn('[espaces] inbox connected');
        // Being listed by the server is not enough: the page says it really receives
        const beat = () => {
          if (next.state === 'connected') {
            void markInboxReady().catch(() => undefined);
          }
        };
        clearInterval(heartbeat);
        beat();
        heartbeat = setInterval(beat, HEARTBEAT_MS);
        refreshPresence();
        if (stopped) {
          clearInterval(heartbeat);
          void next.disconnect();
        }
      } catch (error) {
        console.warn('[espaces] inbox connection failed:', error);
        retry();
      }
    };

    // Back on the page (or back online): do not wait for the next retry
    const wake = () => {
      if (
        !stopped &&
        document.visibilityState === 'visible' &&
        room?.state === 'disconnected'
      ) {
        clearTimeout(timer);
        delay = FIRST_DELAY_MS;
        void connect();
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);

    void connect();

    return () => {
      stopped = true;
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      clearTimeout(timer);
      void room?.disconnect();
      refreshPresence();
    };
  }, [active, queryClient]);

  return null;
};
