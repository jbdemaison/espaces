import { Box, Text } from '@/components';

import { STATUS_EMOJI } from '../statuses';
import { Occupant } from '../types';

const MAX_SHOWN = 8;
const SIZE = 22;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

/**
 * A round avatar. It shows the initials today; this is the one place to swap
 * for a photo if users ever get one.
 */
export const OccupantAvatar = ({
  occupant,
  size = SIZE,
}: {
  occupant: Occupant;
  size?: number;
}) => (
  <span
    aria-hidden="true"
    data-status={occupant.status ?? 'available'}
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
      background:
        'var(--c--contextuals--background--semantic--brand--tertiary)',
      color: 'var(--c--contextuals--content--semantic--brand--primary)',
      border:
        '1px solid var(--c--contextuals--content--semantic--brand--primary)',
    }}
  >
    {initials(occupant.name)}
    <span
      style={{
        position: 'absolute',
        right: -4,
        bottom: -3,
        fontSize: Math.round(size * 0.5),
        lineHeight: 1,
      }}
    >
      {STATUS_EMOJI[occupant.status ?? 'available']}
    </span>
  </span>
);

/**
 * The people connected to a room, one line each under its name, like the
 * voice channels of Discord: a round avatar and the full name.
 */
export const RoomOccupants = ({
  roomId,
  occupants,
}: {
  roomId: string;
  occupants: Occupant[];
}) => {
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
          <Text
            $size="xs"
            $variation="secondary"
            $css="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;"
          >
            {occupant.name}
          </Text>
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
