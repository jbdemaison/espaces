import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { useInvitations } from '../../stores/useInvitations';
import { RoomOccupants } from '../RoomOccupants';

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));

describe('<RoomOccupants />', () => {
  beforeEach(() => {
    useInvitations.setState({ request: undefined });
  });

  it('shows the situation of a person: emoji on the avatar, text under the name', () => {
    render(
      <RoomOccupants
        roomId="r1"
        occupants={[
          {
            user_id: 'u1',
            name: 'Ana Martin',
            situation: { emoji: '🎧', text: 'Focusing' },
          },
        ]}
      />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByTestId('occupant-situation-emoji').textContent).toBe(
      '🎧',
    );
    expect(screen.getByTestId('occupant-situation-text').textContent).toBe(
      'Focusing',
    );
  });

  it('shows nothing more than the name when there is no situation', () => {
    render(
      <RoomOccupants
        roomId="r1"
        occupants={[{ user_id: 'u1', name: 'Ana Martin', situation: null }]}
      />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByText('Ana Martin')).toBeTruthy();
    expect(screen.queryByTestId('occupant-situation-emoji')).toBeNull();
    expect(screen.queryByTestId('occupant-situation-text')).toBeNull();
  });

  it('shows an emoji alone, without a line of text', () => {
    render(
      <RoomOccupants
        roomId="r1"
        occupants={[
          {
            user_id: 'u1',
            name: 'Ana Martin',
            situation: { emoji: '🌴', text: '' },
          },
        ]}
      />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByTestId('occupant-situation-emoji')).toBeTruthy();
    expect(screen.queryByTestId('occupant-situation-text')).toBeNull();
  });

  it('marks the people who are reachable, next to their status', () => {
    render(
      <RoomOccupants
        roomId="r1"
        spaceId="s1"
        occupants={[
          {
            user_id: 'u1',
            name: 'Ana Martin',
            situation: { emoji: '🍽️', text: 'Lunch' },
            reachable: true,
          },
          { user_id: 'u2', name: 'Bob Durand', reachable: false },
        ]}
      />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByTestId('occupant-reachable-u1')).toBeTruthy();
    expect(screen.queryByTestId('occupant-reachable-u2')).toBeNull();
    // the status stays visible: emoji on the avatar, text under the name
    expect(screen.getByTestId('occupant-situation-text').textContent).toBe(
      'Lunch',
    );
  });

  it('invites a reachable person from the mark, but not to the room they are in', async () => {
    render(
      <RoomOccupants
        roomId="r1"
        spaceId="s1"
        occupants={[{ user_id: 'u1', name: 'Ana Martin', reachable: true }]}
      />,
      { wrapper: AppWrapper },
    );

    await userEvent.click(screen.getByTestId('occupant-reachable-u1'));

    expect(useInvitations.getState().request).toMatchObject({
      spaceId: 's1',
      excludeRoomId: 'r1',
      person: { user_id: 'u1' },
    });
  });

  it('shows the mark of the user without making it a button', () => {
    render(
      <RoomOccupants
        roomId="r1"
        spaceId="s1"
        occupants={[{ user_id: 'me', name: 'Me', reachable: true }]}
      />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByTestId('occupant-reachable-me').tagName).toBe('SPAN');
  });
});
