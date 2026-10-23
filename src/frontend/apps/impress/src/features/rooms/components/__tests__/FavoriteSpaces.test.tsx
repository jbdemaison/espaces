import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { FavoriteSpaces } from '../FavoriteSpaces';
import { SpaceReachable } from '../SpaceReachable';

const base = 'http://test.jest/api/v1.0';

const spaces = [
  {
    id: 'space-1',
    title: 'Lab',
    emoji: '🧪',
    favorite: true,
    reachable: false,
    rooms: [{ id: 'room-1', title: 'Design', emoji: '🎨', favorite: true }],
  },
];

describe('<FavoriteSpaces />', () => {
  let current = spaces;

  beforeEach(() => {
    current = spaces;
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${base}/documents/favorite-spaces/`, () => ({
      results: current,
    }));
  });

  it('lists the favorite spaces with their favorite sub-spaces, flat', async () => {
    render(<FavoriteSpaces />, { wrapper: AppWrapper });

    const space = await screen.findByTestId('favorite-space-space-1');

    expect(space.textContent).toContain('🧪 Lab');
    // no accordion: the sub-spaces are there at once
    expect(screen.getByTestId('favorite-room-room-1').textContent).toContain(
      'Design',
    );
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
  });

  it('removes a sub-space from the list when its star is taken off', async () => {
    fetchMock.delete(`${base}/documents/room-1/favorite/`, 204);
    render(<FavoriteSpaces />, { wrapper: AppWrapper });
    await screen.findByTestId('favorite-room-room-1');
    current = [{ ...spaces[0], rooms: [] }];

    await userEvent.click(
      screen.getByRole('button', {
        name: /Remove the sub-space from the favorites|Retirer le salon des favoris/,
      }),
    );

    await waitFor(() =>
      expect(screen.queryByTestId('favorite-room-room-1')).toBeNull(),
    );
  });

  it('makes the person reachable from a favorite space', async () => {
    fetchMock.put(`${base}/documents/space-1/reachable/`, {
      reachable: true,
    });
    render(<FavoriteSpaces />, { wrapper: AppWrapper });

    const toggle = await screen.findByTestId(
      'favorite-space-reachable-space-1',
    );
    await userEvent.click(toggle);

    await waitFor(() =>
      expect(
        JSON.parse(
          fetchMock.callHistory.lastCall(`${base}/documents/space-1/reachable/`)
            ?.options.body as string,
        ),
      ).toEqual({ reachable: true }),
    );
  });

  it('opens the space itself from its name', async () => {
    render(<FavoriteSpaces />, { wrapper: AppWrapper });

    const link = await screen.findByTestId('favorite-space-link-space-1');

    expect(link.getAttribute('href')).toBe('/docs/space-1');
  });
});

describe('<SpaceReachable />', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('shows nothing when nobody is reachable', async () => {
    fetchMock.get(`${base}/documents/spaces-reachable/?ids=space-1`, {
      spaces: {},
    });
    render(<SpaceReachable spaceId="space-1" />, { wrapper: AppWrapper });

    await waitFor(() =>
      expect(fetchMock.callHistory.calls().length).toBeGreaterThan(0),
    );
    expect(screen.queryByTestId('space-reachable-space-1')).toBeNull();
  });

  it('lists the people reachable from the space', async () => {
    fetchMock.get(`${base}/documents/spaces-reachable/?ids=space-1`, {
      spaces: {
        'space-1': [{ user_id: 'u1', name: 'Ana Martin' }],
      },
    });
    render(<SpaceReachable spaceId="space-1" />, { wrapper: AppWrapper });

    const block = await screen.findByTestId('space-reachable-space-1');
    expect(block.textContent).toContain('Ana Martin');
  });
});
