import { UserMenu } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box } from '@/components';
import { Waffle } from '@/components/Waffle';
import {
  ButtonLogin,
  ProfilePhotoButton,
  avatarSrc,
  gotoLogout,
  useAuth,
} from '@/features/auth';
import { HelpMenu } from '@/features/help';
import { LanguagePicker } from '@/features/language/components/LanguagePicker';
import { UserStatusPicker } from '@/features/rooms/components/UserStatusPicker';

const FooterActionsGlobalStyle = createGlobalStyle<{ $photo?: string }>`
  .user-menu__actions .c__language-picker{
    width: auto;
  }

  /* the profile picture replaces the initials of the user menu */
  ${({ $photo }) =>
    $photo
      ? `.--docs--footer-actions .c__avatar,
        .user-menu__popover .c__avatar {
          background: url("${$photo}") center / cover no-repeat !important;
        }
        .--docs--footer-actions .c__avatar__initials,
        .user-menu__popover .c__avatar__initials {
          visibility: hidden;
        }`
      : ''}
`;

type FooterActionsProps = {
  withLogin?: boolean;
};

export const FooterActions = ({ withLogin }: FooterActionsProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const userMenu = user || {
    full_name: t('Guest', {
      description: 'Name displayed for a user not logged in',
    }),
    email: '',
  };

  return (
    <>
      <FooterActionsGlobalStyle
        $photo={
          user?.avatar_version
            ? avatarSrc(user.id, user.avatar_version)
            : undefined
        }
      />
      <Box
        $padding={{ horizontal: 'sm' }}
        $direction="row"
        $align="center"
        $gap="3xs"
        $justify="space-between"
        className="--docs--footer-actions"
      >
        <Box $direction="row" $align="center" $gap="3xs">
          <UserMenu
            user={userMenu}
            logout={user ? gotoLogout : undefined}
            actions={
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <LanguagePicker />
                {user && <ProfilePhotoButton />}
              </div>
            }
            withMobileView={false}
          />
          {user && withLogin && <UserStatusPicker />}
          <Waffle />
          {withLogin && <ButtonLogin />}
        </Box>
        <HelpMenu />
      </Box>
    </>
  );
};
