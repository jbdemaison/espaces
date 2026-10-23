import { useTranslation } from 'react-i18next';

import { Box, Card, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

/**
 * The banner telling the user that the connection is lost. In a video room there is
 * nothing to edit: the video and the chat need the connection.
 */
export const AlertOffline = ({ forRoom = false }: { forRoom?: boolean }) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <Card
      className="--docs--alert-offline"
      aria-label={t('Alert offline document', {
        description:
          'Accessible name of the banner telling the user is offline',
      })}
      $radius={spacingsTokens['3xs']}
      $padding="xs"
      $flex={1}
      $gap="3xs"
      $justify="space-between"
      $theme="warning"
    >
      <Box $withThemeInherited $direction="row" $align="center" $gap="2xs">
        <Icon
          $withThemeInherited
          iconName="android_wifi_4_bar_off"
          variant="symbols-outlined"
          $shrink="0"
        />
        <Text $theme="warning">
          {forRoom
            ? t(
                "You're offline. The video and the chat will work again once you're back online.",
                {
                  description:
                    'Banner shown in a video room when the connection is lost',
                },
              )
            : t(
                "You're offline. You can keep editing, and your changes will sync automatically once you're back online.",
                { description: 'Banner shown when the connection is lost' },
              )}
        </Text>
      </Box>
    </Card>
  );
};
