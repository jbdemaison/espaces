import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { KEY_AUTH } from './useAuthQuery';
import { User } from './types';

/** Sends the cropped picture; the answer is the user, with the new picture version. */
export const useUploadAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation<User, APIError, Blob>({
    mutationFn: async (image) => {
      const body = new FormData();
      body.append('image', image, 'avatar');
      const response = await fetchAPI('users/me/avatar/', {
        method: 'PUT',
        body,
        withoutContentType: true,
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to save the picture',
          await errorCauses(response),
        );
      }
      return (await response.json()) as User;
    },
    onSuccess: ({ avatar_version }) => {
      queryClient.setQueryData<User | null>([KEY_AUTH], (user) =>
        user ? { ...user, avatar_version } : user,
      );
      void queryClient.invalidateQueries({ queryKey: ['room-presence'] });
      void queryClient.invalidateQueries({ queryKey: ['space-reachable'] });
    },
  });
};

export const useRemoveAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation<void, APIError>({
    mutationFn: async () => {
      const response = await fetchAPI('users/me/avatar/', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to remove the picture',
          await errorCauses(response),
        );
      }
    },
    onSuccess: () => {
      queryClient.setQueryData<User | null>([KEY_AUTH], (user) =>
        user ? { ...user, avatar_version: null } : user,
      );
      void queryClient.invalidateQueries({ queryKey: ['room-presence'] });
      void queryClient.invalidateQueries({ queryKey: ['space-reachable'] });
    },
  });
};
