import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BoxButton, Text } from '@/components';

import { useMyStatus, useSetMyStatus } from '../api';
import { STATUS_EMOJI, STATUS_ORDER } from '../statuses';
import { Status } from '../types';

/**
 * Lets the person say whether they are available, busy or back later. The choice goes
 * on their round of initials in the rooms, for everybody.
 */
export const UserStatusPicker = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { data: status = 'available' } = useMyStatus();
  const { mutate: setStatus } = useSetMyStatus();

  const labels = useMemo<Record<Status, string>>(
    () => ({
      available: t('Available', { description: 'Status of someone available' }),
      busy: t('Unavailable', {
        description: 'Status of someone not available',
      }),
      away: t('Back later', {
        description: 'Status of someone away for a moment',
      }),
    }),
    [t],
  );

  const options = useMemo<DropdownMenuItem[]>(
    () =>
      STATUS_ORDER.map((value) => ({
        label: labels[value],
        icon: (
          <span aria-hidden="true" style={{ marginRight: 8 }}>
            {STATUS_EMOJI[value]}
          </span>
        ),
        callback: () => setStatus(value),
      })),
    [labels, setStatus],
  );

  return (
    <DropdownMenu options={options} isOpen={isOpen} onOpenChange={setIsOpen}>
      <BoxButton
        data-testid="user-status-picker"
        color="tertiary-text"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={t('Your status: {{status}}', {
          description: 'Accessible name of the button choosing the status',
          status: labels[status],
        })}
        $direction="row"
        $align="center"
        $gap="xs"
        $padding={{ horizontal: 'xs', vertical: '4xs' }}
      >
        <span aria-hidden="true">{STATUS_EMOJI[status]}</span>
        <Text $size="xs">{labels[status]}</Text>
      </BoxButton>
    </DropdownMenu>
  );
};
