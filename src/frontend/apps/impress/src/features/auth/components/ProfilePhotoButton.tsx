import { Button } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../hooks';
import { useProfilePhotoDialog } from '../profilePhotoDialog';

import { ProfilePhotoModal } from './ProfilePhotoModal';

/** In the user menu: opens the dialog choosing the profile picture. */
export const ProfilePhotoButton = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const setOpen = useProfilePhotoDialog((state) => state.setOpen);

  if (!user) {
    return null;
  }

  return (
    <Button
      data-testid="profile-photo-button"
      variant="tertiary"
      size="small"
      onClick={(event) => {
        // The user menu must be closed first: while it is open the rest of the page
        // (where the dialog is shown) cannot be clicked.
        event.currentTarget.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        setTimeout(() => setOpen(true), 150);
      }}
    >
      {user.avatar_version
        ? t('Change my profile picture', {
            description: 'Button of the user menu',
          })
        : t('Add a profile picture', {
            description: 'Button of the user menu',
          })}
    </Button>
  );
};

/**
 * The dialog itself lives at the root of the app: opened from inside the user menu it
 * would be closed and made unreachable with the menu.
 */
export const ProfilePhotoHost = () => {
  const { user } = useAuth();
  const open = useProfilePhotoDialog((state) => state.open);
  const setOpen = useProfilePhotoDialog((state) => state.setOpen);

  if (!open || !user) {
    return null;
  }
  return <ProfilePhotoModal user={user} onClose={() => setOpen(false)} />;
};
