import { Button } from '@gouvfr-lasuite/ui-components';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { ProConnectButton, gotoLogin } from '@/features/auth';
import { useResponsiveStore } from '@/stores';

import banner from '../assets/banner.jpg';

import { EspacesLogo } from '@/features/header/components/EspacesLogo';

import { getHeaderHeight } from './HomeHeader';

export default function HomeBanner() {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { isMobile, isSmallMobile } = useResponsiveStore();
  const { data: config } = useConfig();
  const withProConnect = config?.theme_customization?.home?.['with-proconnect'];

  return (
    <Box
      $maxWidth="78rem"
      $width="100%"
      $justify="space-around"
      $align="center"
      $height="100vh"
      $margin={{ top: `-${getHeaderHeight(isSmallMobile)}px` }}
      $position="relative"
      className="--docs--home-banner"
    >
      <Box
        $width="100%"
        $justify="center"
        $align="center"
        $position="relative"
        $direction={!isMobile ? 'row' : 'column'}
        $gap="1rem"
        $overflow="auto"
        $css="flex-basis: 70%;"
      >
        <Box
          $width={!isMobile ? '50%' : '100%'}
          $justify="center"
          $align="center"
          $gap={spacingsTokens['sm']}
        >
          <EspacesLogo size={72} />
          <Text
            as="h2"
            $size={!isMobile ? 'xs-alt' : '2.3rem'}
            $weight="bold"
            $textAlign="center"
            $margin="none"
            $css={css`
              line-height: ${!isMobile ? '56px' : '45px'};
            `}
          >
            {t('Remote office life.', {
              description: 'Main headline of the home page',
            })}
          </Text>
          <Text
            $size="lg"
            $textAlign="center"
            $margin={{ bottom: 'small' }}
            $variation="secondary"
          >
            {t(
              'Spend your day with your colleagues, online, and talk whenever you need to.',
              { description: 'Subtitle of the home page headline' },
            )}
          </Text>
          {withProConnect ? (
            <ProConnectButton />
          ) : (
            <Button
              onClick={() => gotoLogin()}
              icon={<Icon iconName="bolt" $color="white" />}
            >
              {t('Join', {
                description: 'Call-to-action button of the home page',
              })}
            </Button>
          )}
        </Box>
        {!isMobile && (
          <Image
            src={banner}
            alt={t('Banner image', {
              description: 'Alt text of the home page banner',
            })}
            priority
            style={{
              width: 'auto',
              maxWidth: '100%',
              height: 'fit-content',
              overflow: 'auto',
              maxHeight: '100%',
            }}
          />
        )}
      </Box>
    </Box>
  );
}
