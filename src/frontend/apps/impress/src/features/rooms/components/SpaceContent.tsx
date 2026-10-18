import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { DocHeader } from '@/docs/doc-header';
import { Doc } from '@/docs/doc-management';
import { useSkeletonStore } from '@/features/skeletons';
import { useResponsiveStore } from '@/stores';

import { RoomStage } from './RoomStage';

/**
 * What the page of a space or of a sub-space shows instead of a document: the usual
 * header, then the video room for a sub-space. A space has no video of its own.
 */
export const SpaceContent = ({ doc }: { doc: Doc }) => {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  const { setIsSkeletonVisible } = useSkeletonStore();
  const isRoom = doc.kind === 'room';

  useEffect(() => {
    setIsSkeletonVisible(false);
  }, [setIsSkeletonVisible, doc.id]);

  // The video only exists inside a sub-space: the space itself is where they are listed
  const stage = isRoom ? (
    <RoomStage key={doc.id} roomId={doc.id} />
  ) : (
    <Box $align="center" $justify="center" $padding="xl">
      <Text $variation="secondary">
        {t(
          'Pick a sub-space in the left column, or create one with New: the video opens inside it.',
          {
            description:
              'Empty state of a space, which has no video of its own',
          },
        )}
      </Text>
    </Box>
  );

  return (
    <Box
      $maxWidth="1100px"
      $width="100%"
      $flex="1"
      $margin={{ horizontal: 'auto' }}
      className="--docs--doc-editor"
    >
      <Box
        $padding={{ horizontal: isDesktop ? '54px' : 'base' }}
        className="--docs--doc-editor-header"
      >
        <DocHeader doc={doc} />
      </Box>
      <Box $padding={{ horizontal: isDesktop ? '54px' : 'base', top: 'md' }}>
        {stage}
      </Box>
    </Box>
  );
};
