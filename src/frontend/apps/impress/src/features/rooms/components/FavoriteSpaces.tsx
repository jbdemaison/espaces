import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Card, Icon, StyledLink, Text } from '@/components';
import { useDeleteFavoriteDoc } from '@/docs/doc-management';
import SubdocsIcon from '@/icons/Subdocs.svg';
import StarFilledIcon from '@/icons/star-filled.svg';
import StarIcon from '@/icons/star.svg';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import {
  KEY_FAVORITE_SPACES,
  KEY_SPACE_REACHABLE,
  useFavoriteSpaces,
  useSetSpaceReachable,
} from '../api';
import { FavoriteSpace, FavoriteSpaceRoom } from '../types';

import { DsfrToggle } from './DsfrToggle';
import { SpaceIcon } from './SpaceIcon';

/** The line of a row, as in the list of favorites of Docs. */
const rowCss = css`
  grid-column: 1 / -1;
  grid-template-columns: subgrid;

  &:nth-child(1n):not(:last-child) {
    border-bottom: 1px solid
      color-mix(
        in srgb,
        var(--c--contextuals--border--surface--primary) 50%,
        transparent
      );
  }
`;

const hoverCss = css`
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  border-radius: 4px;

  &:hover {
    background-color: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }
`;

const withEmoji = (emoji: string, title: string) =>
  emoji ? `${emoji} ${title}` : title;

/** The star of an item: taking it off removes the item from the favorites. */
const StarButton = ({
  label,
  onClick,
  testId,
}: {
  label: string;
  onClick: () => void;
  testId?: string;
}) => (
  <button
    type="button"
    aria-pressed
    aria-label={label}
    title={label}
    data-testid={testId}
    onClick={onClick}
    style={{
      display: 'inline-flex',
      border: 'none',
      background: 'transparent',
      padding: 4,
      cursor: 'pointer',
      color: 'var(--c--contextuals--content--semantic--neutral--primary)',
    }}
  >
    <StarFilledIcon aria-hidden="true" width={16} height={16} />
  </button>
);

const SpaceRow = ({
  space,
  onUnstar,
  isPending,
  onReachable,
}: {
  space: FavoriteSpace;
  onUnstar: (id: string) => void;
  isPending: boolean;
  onReachable: (id: string, reachable: boolean) => void;
}) => {
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();

  return (
    <Box
      role="listitem"
      $display="grid"
      $padding={{ vertical: '4xs' }}
      $align="center"
      $css={rowCss}
      data-testid={`favorite-space-${space.id}`}
    >
      <Box
        $display="grid"
        $align="center"
        $margin={{ vertical: '3xs' }}
        $padding={{ right: '3xs' }}
        $css={hoverCss}
      >
        <Box $direction="row" $align="center" $gap="xs" $css="min-width: 0;">
          <StyledLink
            href={`/docs/${space.id}/`}
            data-testid={`favorite-space-link-${space.id}`}
            $css={css`
              flex: 0 1 auto;
              min-width: 0;
              align-items: center;
            `}
          >
            <Box
              $direction="row"
              $align="center"
              $gap="sm"
              $css="min-width: 0;"
            >
              <Icon
                $shrink="0"
                icon={
                  <SpaceIcon
                    width={isSmallMobile ? '35px' : '40px'}
                    height={isSmallMobile ? '35px' : '40px'}
                    aria-hidden="true"
                  />
                }
              />
              <Text
                $size="sm"
                $weight="500"
                $css="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
              >
                {withEmoji(space.emoji, space.title)}
              </Text>
            </Box>
          </StyledLink>
          <StarButton
            label={t('Remove the space from the favorites', {
              description: 'Button unstarring a space',
            })}
            testId={`favorite-space-star-${space.id}`}
            onClick={() => onUnstar(space.id)}
          />
        </Box>
        <Box $direction="row" $align="center" $justify="flex-end">
          <DsfrToggle
            hideLabel
            label={t('Reachable', {
              description: 'Column of the favorites: can be invited to join it',
            })}
            stateLabels={{
              on: t('On', { description: 'State of a switch that is on' }),
              off: t('Off', { description: 'State of a switch that is off' }),
            }}
            checked={space.reachable}
            disabled={isPending}
            data-testid={`favorite-space-reachable-${space.id}`}
            onChange={(reachable) => onReachable(space.id, reachable)}
          />
        </Box>
      </Box>
    </Box>
  );
};

const RoomRow = ({
  room,
  onUnstar,
}: {
  room: FavoriteSpaceRoom;
  onUnstar: (id: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      role="listitem"
      $display="grid"
      $padding={{ vertical: '4xs' }}
      $align="center"
      $css={rowCss}
      data-testid={`favorite-room-${room.id}`}
    >
      <Box
        $display="grid"
        $align="center"
        $margin={{ vertical: '3xs' }}
        $padding={{ right: '3xs', left: '2xl' }}
        $css={hoverCss}
      >
        <Box $direction="row" $align="center" $gap="xs" $css="min-width: 0;">
          <StyledLink
            href={`/docs/${room.id}/`}
            $css={css`
              flex: 0 1 auto;
              min-width: 0;
              align-items: center;
            `}
          >
            <Box
              $direction="row"
              $align="center"
              $gap="sm"
              $css="min-width: 0;"
            >
              <Icon
                $shrink="0"
                icon={
                  <SubdocsIcon
                    width="32px"
                    height="32px"
                    aria-hidden="true"
                    color="var(--c--contextuals--content--semantic--info--tertiary)"
                  />
                }
              />
              <Text
                $size="sm"
                $weight="500"
                $css="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
              >
                {withEmoji(room.emoji, room.title)}
              </Text>
            </Box>
          </StyledLink>
          <StarButton
            label={t('Remove the sub-space from the favorites', {
              description: 'Button unstarring a sub-space',
            })}
            onClick={() => onUnstar(room.id)}
          />
        </Box>
        <span />
      </Box>
    </Box>
  );
};

/**
 * The favorites page, laid out like the one of Docs: a title with the star, then a
 * list with a header, one row per favorite space and, under it, its favorite
 * sub-spaces. The switch of a space says whether the person can be invited from it.
 * Taking the star off an item removes it from the list.
 */
export const FavoriteSpaces = () => {
  const { t } = useTranslation();
  const { isDesktop, isSmallMobile } = useResponsiveStore();
  const { data: spaces = [], isLoading } = useFavoriteSpaces();
  const { mutate: setReachable, isPending } = useSetSpaceReachable();
  const refresh = {
    listInvalidQueries: [KEY_FAVORITE_SPACES, KEY_SPACE_REACHABLE],
  };
  const { mutate: unstar } = useDeleteFavoriteDoc(refresh);

  return (
    <Box
      className="--docs--doc-grid"
      data-testid="favorite-spaces"
      $position="relative"
      $padding={{
        horizontal: isSmallMobile ? '0' : 'sm',
        vertical: isSmallMobile ? '0' : 'sm',
      }}
      $width="100%"
      $maxWidth="960px"
      $minHeight="0"
      $align="center"
    >
      <Card
        $width="100%"
        $border="none"
        $background="transparent"
        $padding={{ bottom: 'md' }}
      >
        <Box
          $direction="row"
          $gap="xs"
          $align="center"
          $padding={{ vertical: 'sm', horizontal: isDesktop ? 'md' : 'xs' }}
        >
          <StarIcon width={24} height={24} aria-hidden="true" />
          <Text as="h2" $size="h4" $margin="none" tabIndex={-1}>
            {t('Starred', {
              description:
                "Name of the filter listing the user's favorite docs",
            })}
          </Text>
        </Box>

        <Text
          as="p"
          $size="sm"
          $variation="secondary"
          $margin="none"
          $padding={{ horizontal: isDesktop ? 'md' : 'xs' }}
          data-testid="favorite-spaces-hint"
        >
          {t(
            'Turn the switch on to be reachable in a space even when you are not in it.',
            { description: 'Explains the switch of the favorites page' },
          )}
        </Text>

        {!isLoading && spaces.length === 0 && (
          <Box
            as="p"
            $padding={{ vertical: 'sm' }}
            $align="center"
            $justify="center"
          >
            <SpaceIcon width={56} height={56} aria-hidden="true" />
            <Text $size="sm" $weight="700">
              {t('No favorite yet', {
                description: 'Empty state heading of the favorites page',
              })}
            </Text>
            <Text $size="sm" $weight="400" $variation="secondary">
              {t('Star a space from its menu to find it here.', {
                description: 'Empty state text of the favorites page',
              })}
            </Text>
          </Box>
        )}

        {spaces.length > 0 && (
          <Box
            $gap="6px"
            $padding={{ vertical: 'sm', horizontal: isDesktop ? 'md' : 'xs' }}
          >
            <Box
              aria-label={t('Favorite spaces', {
                description: 'Accessible name of the list of favorite spaces',
              })}
              $display="grid"
              $css={css`
                grid-template-columns: minmax(0, 550px) auto;
                column-gap: 20px;
              `}
            >
              <Box
                $display="grid"
                $css={css`
                  grid-column: 1 / -1;
                  grid-template-columns: subgrid;
                `}
              >
                <Box $padding={{ all: '3xs' }}>
                  <Text $size="xs" $variation="secondary" $weight="500">
                    {t('Name', {
                      description:
                        'Column header and sort button: document name',
                    })}
                  </Text>
                </Box>
                <Box
                  $align="flex-end"
                  $padding={{ vertical: '3xs', right: '3xs' }}
                >
                  <Text
                    $size="xs"
                    $weight="500"
                    $variation="secondary"
                    $direction="row"
                    $align="center"
                    $gap="2xs"
                  >
                    <span aria-hidden="true">👋</span>{' '}
                    {t('Reachable', {
                      description:
                        'Column of the favorites: can be invited to join it',
                    })}
                  </Text>
                </Box>
              </Box>
              <Box role="list" $display="contents">
                {spaces.map((space) => (
                  <Box key={space.id} $display="contents">
                    <SpaceRow
                      space={space}
                      isPending={isPending}
                      onUnstar={(id) => unstar({ id })}
                      onReachable={(id, reachable) =>
                        setReachable({ id, reachable })
                      }
                    />
                    {space.rooms.map((room) => (
                      <RoomRow
                        key={room.id}
                        room={room}
                        onUnstar={(id) => unstar({ id })}
                      />
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Card>
    </Box>
  );
};
