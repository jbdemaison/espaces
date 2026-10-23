import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';

import { useSpaceReachable } from '../api';
import { useInvitations } from '../stores/useInvitations';

import { OccupantAvatar } from './RoomOccupants';

/**
 * Under the sub-spaces of a space, after a separator: the people who are reachable
 * from this space, to invite to one of its sub-spaces with a click on their name.
 * Nothing is shown when nobody is.
 */
export const SpaceReachable = ({ spaceId }: { spaceId: string }) => {
  const { t } = useTranslation();
  const { data: people = [] } = useSpaceReachable(spaceId);
  const ask = useInvitations((state) => state.ask);

  if (people.length === 0) {
    return null;
  }

  return (
    <Box
      data-testid={`space-reachable-${spaceId}`}
      $padding={{ horizontal: 'sm', top: 'xs', bottom: 'sm' }}
      $css="position: relative; z-index: 2;"
    >
      <hr
        style={{
          width: '100%',
          border: 'none',
          borderTop:
            '1px solid var(--c--contextuals--border--surface--primary, #ddd)',
          margin: '4px 0 8px',
        }}
      />
      <Text
        $size="xs"
        $variation="tertiary"
        $margin={{ bottom: 'xs' }}
        $direction="row"
        $align="center"
        $gap="2xs"
      >
        <span aria-hidden="true">👋</span>
        {t('Reachable', {
          description:
            'Heading above the people who can be invited from a space',
        })}
      </Text>
      <Box as="ul" $css="list-style: none; margin: 0; padding: 0; gap: 6px;">
        {people.map((person) => (
          <Box
            as="li"
            key={person.user_id}
            data-testid={`reachable-${person.user_id}`}
          >
            <button
              type="button"
              disabled={person.busy}
              title={
                person.busy
                  ? t(
                      'Several invitations are already waiting for this person.',
                      {
                        description:
                          'Tooltip on a person who cannot be invited now',
                      },
                    )
                  : t('Invite to join', {
                      description:
                        'Title of the dialog asking to invite somebody to a sub-space',
                    })
              }
              onClick={() => ask({ spaceId, person })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'transparent',
                font: 'inherit',
                textAlign: 'left',
                cursor: person.busy ? 'default' : 'pointer',
                opacity: person.busy ? 0.5 : 0.9,
              }}
            >
              <OccupantAvatar occupant={person} grey />
              <Box $css="min-width: 0; flex: 1;">
                <Text
                  $size="xs"
                  $variation="tertiary"
                  $css="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;"
                >
                  {person.name}
                </Text>
                {person.situation?.text && (
                  <Text
                    $size="xs"
                    $variation="tertiary"
                    $weight={300}
                    data-testid="reachable-situation-text"
                    $css="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;"
                  >
                    {person.situation.text}
                  </Text>
                )}
              </Box>
            </button>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
