import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export const KEY_SPACE_SOUNDS = 'space-sounds';

export interface SpaceSound {
  id: string;
  name: string;
  emoji: string;
  version: number;
  can_delete: boolean;
}

export interface SpaceSounds {
  results: SpaceSound[];
  can_add: boolean;
  max_bytes: number;
  max_seconds: number;
  max_count: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only well-formed ids go into an address: they come from other people's messages. */
export const isSoundId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

/** The sounds of the space of a room (or of a space). */
export const useSpaceSounds = (documentId: string, enabled = true) =>
  useQuery<SpaceSounds, APIError>({
    queryKey: [KEY_SPACE_SOUNDS, documentId],
    enabled,
    queryFn: async () => {
      const response = await fetchAPI(`documents/${documentId}/sounds/`);
      if (!response.ok) {
        throw new APIError(
          'Failed to load the sounds',
          await errorCauses(response),
        );
      }
      return (await response.json()) as SpaceSounds;
    },
  });

export const useAddSound = (documentId: string) => {
  const queryClient = useQueryClient();
  return useMutation<
    SpaceSound,
    APIError,
    { name: string; emoji: string; file: File }
  >({
    mutationFn: async ({ name, emoji, file }) => {
      const body = new FormData();
      body.append('name', name);
      body.append('emoji', emoji);
      body.append('file', file, file.name);
      const response = await fetchAPI(`documents/${documentId}/sounds/`, {
        method: 'POST',
        body,
        withoutContentType: true,
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to add the sound',
          await errorCauses(response),
        );
      }
      return (await response.json()) as SpaceSound;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [KEY_SPACE_SOUNDS] }),
  });
};

export const useDeleteSound = (documentId: string) => {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, string>({
    mutationFn: async (soundId) => {
      const response = await fetchAPI(
        `documents/${documentId}/sounds/${soundId}/`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new APIError(
          'Failed to remove the sound',
          await errorCauses(response),
        );
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [KEY_SPACE_SOUNDS] }),
  });
};

const blobUrls = new Map<string, Promise<string>>();

/** The address of the audio of a sound, fetched once and kept for the session. */
export const soundUrl = (documentId: string, soundId: string) => {
  const key = `${documentId}:${soundId}`;
  let url = blobUrls.get(key);
  if (!url) {
    url = fetchAPI(`documents/${documentId}/sounds/${soundId}/`).then(
      async (response) => {
        if (!response.ok) {
          throw new Error('sound not available');
        }
        return URL.createObjectURL(await response.blob());
      },
    );
    url.catch(() => blobUrls.delete(key));
    blobUrls.set(key, url);
  }
  return url;
};

/** Length of an audio file in seconds; rejects when it cannot be read as a sound. */
export const audioDuration = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = () => URL.revokeObjectURL(url);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      done();
      resolve(audio.duration);
    };
    audio.onerror = () => {
      done();
      reject(new Error('unreadable'));
    };
    audio.src = url;
  });
