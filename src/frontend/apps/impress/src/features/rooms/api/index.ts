import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  getEmojiAndTitle,
} from '@/docs/doc-management';

import {
  FavoriteSpace,
  InvitationAnswer,
  InvitationRefusal,
  InvitationStatus,
  Occupant,
  MyStatus,
  PresenceByRoom,
  RoomAccess,
} from '../types';

export const DEFAULT_ROOM_EMOJI = '💬';

export const KEY_ROOM_PRESENCE = 'room-presence';
export const KEY_ROOM_ACCESS = 'room-access';
export const KEY_MY_STATUS = 'my-status';
export const KEY_FAVORITE_SPACES = 'favorite-spaces';
export const KEY_SPACE_REACHABLE = 'space-reachable';
export const KEY_SPACE_ROOMS = 'space-rooms';

const fail = async (message: string, response: Response) =>
  new APIError(message, await errorCauses(response));

/** The emoji of a space or of a room is the first character of its title, as in Docs. */
export const withEmoji = (title: string, emoji: string) =>
  emoji ? `${emoji} ${title}` : title;

/** Who is in a room: refreshed every few seconds. */
export const useRoomPresence = (roomId: string, enabled = true) =>
  useQuery({
    enabled,
    queryKey: [KEY_ROOM_PRESENCE, roomId],
    refetchInterval: 5000,
    retry: false,
    queryFn: async (): Promise<Occupant[]> => {
      const response = await fetchAPI(
        `documents/rooms-presence/?ids=${roomId}`,
      );
      if (!response.ok) {
        throw await fail('Failed to get the presence', response);
      }
      const { rooms } = (await response.json()) as { rooms: PresenceByRoom };
      return Object.values(rooms)[0] ?? [];
    },
  });

/**
 * The people who can be invited from a space, without being in one of its
 * sub-spaces: they marked the space as reachable and are connected.
 */
export const useSpaceReachable = (spaceId: string, enabled = true) =>
  useQuery({
    enabled,
    queryKey: [KEY_SPACE_REACHABLE, spaceId],
    refetchInterval: 5000,
    retry: false,
    queryFn: async (): Promise<Occupant[]> => {
      const response = await fetchAPI(
        `documents/spaces-reachable/?ids=${spaceId}`,
      );
      if (!response.ok) {
        throw await fail('Failed to get the reachable people', response);
      }
      const { spaces } = (await response.json()) as {
        spaces: PresenceByRoom;
      };
      return spaces[spaceId] ?? [];
    },
  });

/** The sub-spaces (video rooms) of a space, to choose where to invite somebody. */
export const useSpaceRooms = (spaceId: string, enabled = true) =>
  useQuery({
    enabled,
    queryKey: [KEY_SPACE_ROOMS, spaceId],
    queryFn: async (): Promise<
      { id: string; title: string; emoji: string }[]
    > => {
      const response = await fetchAPI(`documents/${spaceId}/children/`);
      if (!response.ok) {
        throw await fail('Failed to list the sub-spaces', response);
      }
      const { results } = (await response.json()) as {
        results: { id: string; title?: string; kind?: string }[];
      };
      return results
        .filter((child) => child.kind === 'room')
        .map((child) => {
          const { emoji, titleWithoutEmoji } = getEmojiAndTitle(
            child.title ?? '',
          );
          return { id: child.id, title: titleWithoutEmoji, emoji: emoji ?? '' };
        });
    },
  });

/** What is needed to connect to a room: the answer wraps it under `livekit`. */
export const getRoomAccess = async (roomId: string): Promise<RoomAccess> => {
  const response = await fetchAPI(`documents/${roomId}/room-access/`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw await fail('Failed to join the room', response);
  }
  const { livekit } = (await response.json()) as { livekit: RoomAccess };
  return livekit;
};

interface CreateParams {
  kind: 'folder' | 'room';
  title: string;
  parentId?: string;
}

const createItem = async ({
  parentId,
  ...body
}: CreateParams): Promise<Doc> => {
  const response = await fetchAPI(
    parentId ? `documents/${parentId}/children/` : 'documents/',
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!response.ok) {
    throw await fail('Failed to create', response);
  }
  return (await response.json()) as Doc;
};

const useRefreshLists = () => {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [KEY_LIST_DOC, KEY_DOC]) {
      void queryClient.resetQueries({ queryKey: [key] });
    }
  };
};

/** A sub-space (a video room), in a space or in another sub-space. */
export function useCreateRoom() {
  const refresh = useRefreshLists();
  return useMutation<
    Doc,
    APIError,
    { title: string; emoji: string; parentId: string }
  >({
    mutationFn: ({ title, emoji, parentId }) =>
      createItem({ kind: 'room', title: withEmoji(title, emoji), parentId }),
    onSuccess: refresh,
  });
}

export const DEFAULT_SPACE_ROOM_TITLE = 'Général';

/**
 * A new space starts with one sub-space, « 💬 Général »: a space with no video room
 * would be an empty page. More are added with "New".
 */
export function useCreateSpace() {
  const refresh = useRefreshLists();
  return useMutation<Doc, APIError, { title: string; emoji: string }>({
    mutationFn: async ({ title, emoji }) => {
      const space = await createItem({
        kind: 'folder',
        title: withEmoji(title, emoji),
      });
      try {
        await createItem({
          kind: 'room',
          title: withEmoji(DEFAULT_SPACE_ROOM_TITLE, DEFAULT_ROOM_EMOJI),
          parentId: space.id,
        });
      } catch {
        // the space exists: its first sub-space can be added by hand
      }
      return space;
    },
    onSuccess: refresh,
  });
}

/** Renewed while the page is open, so that the situation lasts 12 h after leaving. */
const STATUS_REFRESH_MS = 30 * 60_000;

/**
 * What the person said about themselves: their situation (shown to the people of
 * their spaces) and whether they are reachable.
 */
export const useMyStatus = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: [KEY_MY_STATUS],
    retry: false,
    refetchInterval: STATUS_REFRESH_MS,
    queryFn: async (): Promise<MyStatus> => {
      const response = await fetchAPI('user-status/');
      if (!response.ok) {
        throw await fail('Failed to get the status', response);
      }
      return (await response.json()) as MyStatus;
    },
  });

/** Changes the situation and/or the reachability: what is left out is kept. */
export function useSetMyStatus() {
  const queryClient = useQueryClient();
  return useMutation<MyStatus, APIError, Partial<MyStatus>>({
    mutationFn: async (changes) => {
      const response = await fetchAPI('user-status/', {
        method: 'PUT',
        body: JSON.stringify(changes),
      });
      if (!response.ok) {
        throw await fail('Failed to change the status', response);
      }
      return (await response.json()) as MyStatus;
    },
    onSuccess: (status) => {
      queryClient.setQueryData([KEY_MY_STATUS], status);
      void queryClient.invalidateQueries({ queryKey: [KEY_ROOM_PRESENCE] });
    },
  });
}

/** The connection to the personal inbox room, kept open while the person is reachable. */
export const getInboxAccess = async (): Promise<RoomAccess> => {
  const response = await fetchAPI('user-inbox/', { method: 'POST' });
  if (!response.ok) {
    throw await fail('Failed to open the inbox', response);
  }
  const { livekit } = (await response.json()) as { livekit: RoomAccess };
  return livekit;
};

/** Says that the page is really connected to the inbox, and can receive. */
export const markInboxReady = async (): Promise<void> => {
  const response = await fetchAPI('user-inbox/ready/', { method: 'POST' });
  if (!response.ok) {
    throw await fail('Failed to confirm the inbox', response);
  }
};

/**
 * The favorites of the person, by space: the spaces they starred and those holding
 * a starred sub-space, each with all its sub-spaces.
 */
export const useFavoriteSpaces = () =>
  useQuery({
    queryKey: [KEY_FAVORITE_SPACES],
    queryFn: async (): Promise<FavoriteSpace[]> => {
      const response = await fetchAPI('documents/favorite-spaces/');
      if (!response.ok) {
        throw await fail('Failed to list the favorite spaces', response);
      }
      return ((await response.json()) as { results: FavoriteSpace[] }).results;
    },
  });

/** Say whether the person can be invited from a favorite space while reachable. */
export function useSetSpaceReachable() {
  const queryClient = useQueryClient();
  return useMutation<boolean, APIError, { id: string; reachable: boolean }>({
    mutationFn: async ({ id, reachable }) => {
      const response = await fetchAPI(`documents/${id}/reachable/`, {
        method: 'PUT',
        body: JSON.stringify({ reachable }),
      });
      if (!response.ok) {
        throw await fail('Failed to change the space', response);
      }
      return reachable;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_FAVORITE_SPACES] });
      void queryClient.invalidateQueries({ queryKey: [KEY_SPACE_REACHABLE] });
    },
  });
}

/** Invite somebody who is reachable in a sub-space to join it. */
export const sendInvitation = async (
  roomId: string,
  userId: string,
  message = '',
): Promise<{ id: string } | { refusal: InvitationRefusal }> => {
  const response = await fetchAPI('invitations/', {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId, user_id: userId, message }),
  });
  if (response.status === 409 || response.status === 403) {
    const body = (await response.json().catch(() => ({}))) as {
      code?: InvitationRefusal;
    };
    return { refusal: body.code ?? 'not_reachable' };
  }
  if (!response.ok) {
    throw await fail('Failed to send the invitation', response);
  }
  return (await response.json()) as { id: string };
};

/** What became of an invitation sent by the person; null when it is forgotten. */
export const getInvitationStatus = async (
  id: string,
): Promise<InvitationStatus | null> => {
  const response = await fetchAPI(`invitations/${id}/`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await fail('Failed to get the invitation', response);
  }
  return ((await response.json()) as { status: InvitationStatus }).status;
};

/** The person invited answers; the status says whether the answer still counted. */
export const answerInvitation = async (
  id: string,
  answer: InvitationAnswer,
): Promise<{ status: string; room_id: string } | null> => {
  const response = await fetchAPI(`invitations/${id}/answer/`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await fail('Failed to answer the invitation', response);
  }
  return (await response.json()) as { status: string; room_id: string };
};
