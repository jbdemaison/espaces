import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { useAuth } from '@/features/auth';
import { avatarSrc } from '@/features/auth/avatar';

import { describeSituation, hasSituation } from '../statuses';
import { useInvitations } from '../stores/useInvitations';
import { Occupant } from '../types';

const MAX_SHOWN = 8;
const REACHABLE_MARK = {
  flexShrink: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  font: 'inherit',
  fontSize: 12,
  lineHeight: 1,
  cursor: 'inherit',
} as const;
const SIZE = 22;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

/** A round avatar: the profile picture of the person, or else their initials. */
export const OccupantAvatar = ({
  occupant,
  size = SIZE,
  grey = false,
}: {
  occupant: Occupant;
  size?: number;
  /** someone who is not in the room but can be invited to it */
  grey?: boolean;
}) => (
  <span
    aria-hidden="true"
    style={{
      position: 'relative',
      flexShrink: 0,
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(size * 0.45),
      fontWeight: 600,
      lineHeight: 1,
      background: grey
        ? '#ECECEC'
        : 'var(--c--contextuals--background--semantic--brand--tertiary)',
      color: grey
        ? '#6B6B6B'
        : 'var(--c--contextuals--content--semantic--brand--primary)',
      border: grey
        ? '1px solid #BDBDBD'
        : '1px solid var(--c--contextuals--content--semantic--brand--primary)',
    }}
  >
    {occupant.avatar_version ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarSrc(occupant.user_id, occupant.avatar_version)}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          objectFit: 'cover',
          filter: grey ? 'grayscale(1)' : undefined,
        }}
      />
    ) : (
      initials(occupant.name)
    )}
    {occupant.situation?.emoji && (
      <span
        data-testid="occupant-situation-emoji"
        style={{
          position: 'absolute',
          right: -4,
          bottom: -3,
          fontSize: Math.round(size * 0.5),
          lineHeight: 1,
        }}
      >
        {occupant.situation.emoji}
      </span>
    )}
  </span>
);

/**
 * The people connected to a room, one line each under its name, like the
 * voice channels of Discord: a round avatar and the full name.
 */
export const RoomOccupants = ({
  roomId,
  occupants,
  spaceId,
}: {
  roomId: string;
  occupants: Occupant[];
  /** the space of the room: those who are reachable can be invited from it */
  spaceId?: string;
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const ask = useInvitations((state) => state.ask);

  if (occupants.length === 0) {
    return null;
  }

  const shown = occupants.slice(0, MAX_SHOWN);
  const hidden = occupants.length - shown.length;

  return (
    <Box
      as="ul"
      data-testid={`room-occupants-${roomId}`}
      $width="100%"
      $css="list-style: none; margin: 4px 0 4px 0; padding: 0; gap: 6px;"
    >
      {shown.map((occupant) => (
        <Box
          as="li"
          key={occupant.user_id}
          $direction="row"
          $align="center"
          $width="100%"
          $css="gap: 8px; min-width: 0;"
        >
          <OccupantAvatar occupant={occupant} />
          <Box
            $css="min-width: 0; flex: 1;"
            title={
              hasSituation(occupant.situation)
                ? describeSituation(occupant.situation!)
                : undefined
            }
          >
            <Text
              $size="xs"
              $variation="secondary"
              $css="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;"
            >
              {occupant.name}
            </Text>
            {occupant.situation?.text && (
              <Text
                $size="xs"
                $variation="tertiary"
                $weight={300}
                data-testid="occupant-situation-text"
                $css="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;"
              >
                {occupant.situation.text}
              </Text>
            )}
          </Box>
          {occupant.reachable &&
            (spaceId && occupant.user_id !== user?.id ? (
              <button
                type="button"
                data-testid={`occupant-reachable-${occupant.user_id}`}
                title={t(
                  'Reachable: click to invite {{name}} to another sub-space',
                  {
                    name: occupant.name,
                    description:
                      'Tooltip of the mark next to a reachable person in a room',
                  },
                )}
                aria-label={t('Invite {{name}} to join', {
                  name: occupant.name,
                  description:
                    'Accessible name of the mark next to a reachable person in a room',
                })}
                onClick={(event) => {
                  // the row is a link to the room
                  event.preventDefault();
                  event.stopPropagation();
                  ask({ spaceId, person: occupant, excludeRoomId: roomId });
                }}
                style={{ ...REACHABLE_MARK, cursor: 'pointer' }}
              >
                👋
              </button>
            ) : (
              <span
                data-testid={`occupant-reachable-${occupant.user_id}`}
                title={t('Reachable', {
                  description:
                    'Switch letting others invite the person to join a room',
                })}
                style={REACHABLE_MARK}
              >
                👋
              </span>
            ))}
        </Box>
      ))}
      {hidden > 0 && (
        <Text $size="xs" $variation="tertiary" as="li">
          +{hidden}
        </Text>
      )}
    </Box>
  );
};
