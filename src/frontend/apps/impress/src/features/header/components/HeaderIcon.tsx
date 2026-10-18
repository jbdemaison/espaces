import { css } from 'styled-components';

import { Box } from '@/components/Box';

import { useHideOnScroll } from '../hooks/useHideOnScroll';

import { EspacesLogo } from './EspacesLogo';

export const HeaderIcon = () => {
  const isVisible = useHideOnScroll();

  return (
    <Box
      $width="32px"
      $height="32px"
      $css={css`
        transition: transform 0.3s ease-in-out;
        ${
          isVisible
            ? css`
                transform: translateY(0);
              `
            : css`
                transform: translateY(-300%);
              `
        }
      `}
    >
      <EspacesLogo size={32} />
    </Box>
  );
};
