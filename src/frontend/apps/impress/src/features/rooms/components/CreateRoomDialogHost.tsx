import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import { useLeftPanelStore } from '@/features/left-panel/stores/useLeftPanelStore';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { DEFAULT_ROOM_EMOJI, useCreateRoom, useCreateSpace } from '../api';
import { useCreateRoomDialog } from '../stores/useCreateRoomDialog';

import { NameDialog } from './NameDialog';

/**
 * The dialog asking for a name and an emoji. It creates a space when opened without a
 * parent, a sub-space (a video room) otherwise, then opens what was created.
 */
export const CreateRoomDialogHost = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const request = useCreateRoomDialog((state) => state.request);
  const close = useCreateRoomDialog((state) => state.close);
  const createSpace = useCreateSpace();
  const createRoom = useCreateRoom();

  if (!request) {
    return null;
  }

  const { parentId } = request;
  const isSpace = !parentId;

  const onCreated = (id: string) => {
    close();
    void router.push(`/docs/${id}`);
    if (isMobile) {
      closePanel();
    }
  };

  const onConfirm = ({ title, emoji }: { title: string; emoji: string }) => {
    if (isSpace) {
      createSpace.mutate(
        { title, emoji },
        { onSuccess: (space) => onCreated(space.id) },
      );
      return;
    }
    createRoom.mutate(
      { title, emoji, parentId },
      { onSuccess: (room) => onCreated(room.id) },
    );
  };

  return (
    <NameDialog
      heading={
        isSpace
          ? t('New space', {
              description: 'Title of the dialog creating a space',
            })
          : t('New sub-space', {
              description:
                'Title of the dialog creating a video room in a space',
            })
      }
      confirmLabel={t('Create', {
        description: 'Button confirming a creation',
      })}
      initialEmoji={isSpace ? '🏢' : DEFAULT_ROOM_EMOJI}
      isPending={createSpace.isPending || createRoom.isPending}
      onConfirm={onConfirm}
      onClose={close}
    />
  );
};
