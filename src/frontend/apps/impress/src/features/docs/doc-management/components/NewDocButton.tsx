import { Button } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useTreeContextOrNull } from '@/docs/doc-tree/utils';
import { SpaceButtonIcon } from '@/features/rooms/components/SpaceIcon';
import { useCreateRoomDialog } from '@/features/rooms/stores/useCreateRoomDialog';

import { Doc } from '../types';
import { useDocStore } from '../stores/useDocStore';

interface NewDocButtonProps {
  onClose?: () => void;
}

/**
 * "New": on the list of spaces it creates a space, inside a space it creates a
 * sub-space (a video room) at the top of that space.
 */
export const NewDocButton = ({ onClose }: NewDocButtonProps) => {
  const { t } = useTranslation();
  const { currentDoc } = useDocStore();
  const treeContext = useTreeContextOrNull<Doc | null>();
  const openCreateDialog = useCreateRoomDialog((state) => state.open);
  // a sub-space (a room) holds nothing: "New" creates in its space
  const spaceId = treeContext?.root?.id ?? currentDoc?.id;

  return (
    <>
      <Button
        data-testid="new-doc-button"
        color="brand"
        onClick={() => {
          onClose?.();
          openCreateDialog(spaceId);
        }}
        icon={<SpaceButtonIcon aria-hidden="true" width={24} height={24} />}
        style={{
          borderRadius: '4px',
        }}
      >
        <Text $withThemeInherited $size="md" $weight="500">
          {t('New', { description: 'Button to create a new document' })}
        </Text>
      </Button>
    </>
  );
};
