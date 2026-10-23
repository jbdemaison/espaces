import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BoxButton, Text } from '@/components';

import { useMyStatus, useSetMyStatus } from '../api';
import { NO_STATUS, describeSituation, hasSituation } from '../statuses';
import { MyStatus, Situation } from '../types';

import { SituationDialog } from './SituationDialog';

const NOBODY: MyStatus = { ...NO_STATUS, reachable: false };

/**
 * Lets the person say what they are up to (an emoji and a short text, seen by the
 * people of the spaces they are in) and, separately, whether others may invite them
 * to join a room.
 */
export const UserStatusPicker = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const { data: status = NOBODY } = useMyStatus();
  const { mutate: setStatus, isPending } = useSetMyStatus();

  const suggestions = useMemo<Situation[]>(
    () => [
      {
        emoji: '🟢',
        text: t('Available', { description: 'Suggested status' }),
      },
      {
        emoji: '🚶',
        text: t('Back soon', { description: 'Suggested status' }),
      },
      {
        emoji: '⛔',
        text: t('Do not disturb', { description: 'Suggested status' }),
      },
    ],
    [t],
  );

  const options = useMemo<DropdownMenuItem[]>(() => {
    const isCustom =
      hasSituation(status) &&
      !suggestions.some(
        (item) => item.emoji === status.emoji && item.text === status.text,
      );
    return [
      ...suggestions.map<DropdownMenuItem>((item) => ({
        label: item.text,
        icon: (
          <span aria-hidden="true" style={{ marginRight: 8 }}>
            {item.emoji}
          </span>
        ),
        isChecked: item.emoji === status.emoji && item.text === status.text,
        callback: () => setStatus(item),
      })),
      {
        label: t('Custom status…', {
          description: 'Menu item opening the dialog writing one’s own status',
        }),
        icon: (
          <span aria-hidden="true" style={{ marginRight: 8 }}>
            ✏️
          </span>
        ),
        isChecked: isCustom,
        testId: 'status-option-custom',
        callback: () => setWriting(true),
      },
      ...(hasSituation(status)
        ? [
            {
              label: t('Clear my status', {
                description: 'Menu item removing one’s own status',
              }),
              testId: 'status-option-clear',
              callback: () => setStatus(NO_STATUS),
            },
          ]
        : []),
      { type: 'separator' as const },
      {
        // "Reachable" is not a status: it holds whatever the status says
        label: t('Reachable', {
          description: 'Switch letting others invite the person to join a room',
        }),
        icon: (
          <span aria-hidden="true" style={{ marginRight: 8 }}>
            👋
          </span>
        ),
        isChecked: status.reachable,
        testId: 'status-option-reachable',
        subText: t('Others can invite you to join a room.', {
          description: 'Explains the switch "Reachable" in the status menu',
        }),
        callback: () => setStatus({ reachable: !status.reachable }),
      },
    ];
  }, [setStatus, status, suggestions, t]);

  const summary = hasSituation(status)
    ? describeSituation(status)
    : t('No status', { description: 'Shown when nobody set a status' });

  return (
    <>
      <DropdownMenu options={options} isOpen={isOpen} onOpenChange={setIsOpen}>
        <BoxButton
          data-testid="user-status-picker"
          color="tertiary-text"
          onClick={() => setIsOpen((open) => !open)}
          aria-label={t('Your status: {{status}}', {
            description: 'Accessible name of the button choosing the status',
            status: summary,
          })}
          $direction="row"
          $align="center"
          $gap="xs"
          $padding={{ horizontal: 'xs', vertical: '4xs' }}
        >
          <span aria-hidden="true">{status.emoji || '💬'}</span>
          <Text $size="xs">
            {status.text ||
              (status.emoji
                ? ''
                : t('Set a status', {
                    description: 'Button opening the menu of the status',
                  }))}
          </Text>
          {status.reachable && (
            <span
              aria-hidden="true"
              data-testid="status-reachable-mark"
              title={t('Reachable', {
                description:
                  'Switch letting others invite the person to join a room',
              })}
            >
              👋
            </span>
          )}
        </BoxButton>
      </DropdownMenu>
      {writing && (
        <SituationDialog
          initial={hasSituation(status) ? status : NO_STATUS}
          isPending={isPending}
          onClose={() => setWriting(false)}
          onConfirm={(situation) => {
            setStatus(situation, { onSuccess: () => setWriting(false) });
          }}
        />
      )}
    </>
  );
};
