import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { Doc, KEY_DOC, KEY_LIST_DOC } from '@/docs/doc-management';

import { PresenceByRoom, RoomAccess, Status } from '../types';

export const KEY_ROOM_PRESENCE = 'room-presence';
export const KEY_ROOM_ACCESS = 'room-access';
export const KEY_MY_STATUS = 'my-status';

export const DEFAULT_ROOM_EMOJI = '💬';

const fail = async (message: string, response: Response) =>
  new APIError(message, await errorCauses(response));

/** The emoji of a space or of a room is the first character of its title, as in Docs. */
export const withEmoji = (title: string, emoji: string) =>
  emoji ? `${emoji} ${title}` : title;

/** Who is in a room, refreshed every few seconds. */
export const useRoomPresence = (roomId: string, enabled = true) =>
  useQuery({
    enabled,
    queryKey: [KEY_ROOM_PRESENCE, roomId],
    refetchInterval: 5000,
    retry: false,
    queryFn: async (): Promise<PresenceByRoom[string]> => {
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

/** A space is empty: its rooms (sub-spaces) are added with "New". */
export function useCreateSpace() {
  const refresh = useRefreshLists();
  return useMutation<Doc, APIError, { title: string; emoji: string }>({
    mutationFn: ({ title, emoji }) => {
      return createItem({ kind: 'folder', title: withEmoji(title, emoji) });
    },
    onSuccess: refresh,
  });
}

/** The status of the person: shown on their initials in the rooms. */
export const useMyStatus = () =>
  useQuery({
    queryKey: [KEY_MY_STATUS],
    retry: false,
    queryFn: async (): Promise<Status> => {
      const response = await fetchAPI('user-status/');
      if (!response.ok) {
        throw await fail('Failed to get the status', response);
      }
      return ((await response.json()) as { status: Status }).status;
    },
  });

export function useSetMyStatus() {
  const queryClient = useQueryClient();
  return useMutation<Status, APIError, Status>({
    mutationFn: async (status) => {
      const response = await fetchAPI('user-status/', {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw await fail('Failed to change the status', response);
      }
      return ((await response.json()) as { status: Status }).status;
    },
    onSuccess: (status) => {
      queryClient.setQueryData([KEY_MY_STATUS], status);
      void queryClient.invalidateQueries({ queryKey: [KEY_ROOM_PRESENCE] });
    },
  });
}
