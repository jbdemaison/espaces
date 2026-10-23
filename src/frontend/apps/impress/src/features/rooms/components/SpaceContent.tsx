import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { DocHeader } from '@/docs/doc-header';
import { AlertOffline } from '@/docs/doc-header/components/AlertOffline';
import { Doc } from '@/docs/doc-management';
import { useIsOffline } from '@/features/service-worker';
import { useSkeletonStore } from '@/features/skeletons';
import { useResponsiveStore } from '@/stores';

import { CHAT_WIDTH, useRoomChat } from '../stores/useRoomChat';

import { RoomChatButton } from './RoomChatButton';
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
  const chatOpen = useRoomChat((state) => state.open);
  const isOffline = useIsOffline((state) => state.isOffline);

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
      // the open chat column takes the right of the window: the page makes room for it
      $css={
        isRoom && chatOpen && isDesktop
          ? `margin-right: ${CHAT_WIDTH}px; max-width: calc(100% - ${CHAT_WIDTH}px);`
          : undefined
      }
    >
      {isRoom && isOffline && (
        // above the header, not inside it: the Chat button sits on the header
        <Box
          $padding={{ horizontal: isDesktop ? '54px' : 'base', top: 'base' }}
        >
          <AlertOffline forRoom />
        </Box>
      )}
      <Box
        $padding={{ horizontal: isDesktop ? '54px' : 'base' }}
        className="--docs--doc-editor-header"
        $css="position: relative;"
      >
        <DocHeader doc={doc} />
        {isRoom && (
          <Box
            $css={`position: absolute; top: 44px; right: ${isDesktop ? '54px' : '16px'};`}
          >
            <RoomChatButton />
          </Box>
        )}
      </Box>
      <Box $padding={{ horizontal: isDesktop ? '54px' : 'base', top: 'md' }}>
        {stage}
      </Box>
    </Box>
  );
};
