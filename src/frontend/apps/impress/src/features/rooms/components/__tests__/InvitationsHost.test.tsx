import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import * as api from '../../api';
import { useInvitations } from '../../stores/useInvitations';
import { InvitationsHost } from '../InvitationsHost';

const push = vi.fn();
vi.mock('next/router', () => ({
  useRouter: () => ({ push, query: {} }),
}));
vi.mock('../../utils/beep', () => ({ playInvitationBeep: vi.fn() }));

const invitation = {
  id: 'inv-1',
  from: { user_id: 'u1', name: 'Bob Durand' },
  room: { id: 'room-1', title: 'Design', emoji: '🎨' },
  space: { id: 'space-1', title: 'Lab', emoji: '🧪' },
  deadline: Date.now() + 60_000,
};

describe('<InvitationsHost />', () => {
  beforeAll(() => {
    // the toasts animate themselves, which jsdom cannot do
    Element.prototype.animate = vi.fn(
      () => ({ finished: Promise.resolve(), cancel: vi.fn() }) as never,
    );
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockClear();
    useInvitations.setState({ request: undefined, incoming: [], outgoing: [] });
  });

  it('shows who invites to which sub-space, and joins it on request', async () => {
    const answer = vi
      .spyOn(api, 'answerInvitation')
      .mockResolvedValue({ status: 'accepted', room_id: 'room-1' });
    render(<InvitationsHost />, { wrapper: AppWrapper });

    act(() => useInvitations.getState().receive(invitation));

    const text = await screen.findByTestId('invitation-inv-1');
    expect(text.textContent).toContain('Bob Durand');
    expect(text.textContent).toContain('🎨 Design');
    expect(text.textContent).toContain('🧪 Lab');

    await userEvent.click(
      screen.getByRole('button', { name: /Join|Rejoindre/ }),
    );

    await waitFor(() => expect(answer).toHaveBeenCalledWith('inv-1', 'accept'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/docs/room-1'));
    expect(useInvitations.getState().incoming).toHaveLength(0);
  });

  it('tells the inviter when the person is unavailable', async () => {
    const answer = vi
      .spyOn(api, 'answerInvitation')
      .mockResolvedValue({ status: 'unavailable', room_id: 'room-1' });
    render(<InvitationsHost />, { wrapper: AppWrapper });

    act(() => useInvitations.getState().receive(invitation));
    await userEvent.click(
      await screen.findByRole('button', { name: /Unavailable|Indisponible/ }),
    );

    await waitFor(() =>
      expect(answer).toHaveBeenCalledWith('inv-1', 'unavailable'),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('stacks several invitations and ignores one on request', async () => {
    const answer = vi
      .spyOn(api, 'answerInvitation')
      .mockResolvedValue({ status: 'ignored', room_id: 'room-1' });
    render(<InvitationsHost />, { wrapper: AppWrapper });

    act(() => {
      useInvitations.getState().receive(invitation);
      useInvitations.getState().receive({ ...invitation, id: 'inv-2' });
    });
    expect(
      await screen.findAllByRole('button', { name: /Ignore|Ignorer/ }),
    ).toHaveLength(2);

    await userEvent.click(
      screen.getAllByRole('button', { name: /Ignore|Ignorer/ })[0],
    );

    await waitFor(() => expect(answer).toHaveBeenCalledTimes(1));
    expect(useInvitations.getState().incoming).toHaveLength(1);
  });

  it('drops an invitation nobody answered in time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<InvitationsHost />, { wrapper: AppWrapper });

    act(() =>
      useInvitations
        .getState()
        .receive({ ...invitation, deadline: Date.now() + 1000 }),
    );
    expect(useInvitations.getState().incoming).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(useInvitations.getState().incoming).toHaveLength(0);
    vi.useRealTimers();
  });

  it('asks where to invite, then sends the invitation and follows it', async () => {
    vi.spyOn(api, 'useSpaceRooms').mockReturnValue({
      data: [
        { id: 'room-1', title: 'Design', emoji: '🎨' },
        { id: 'room-2', title: 'Bizdev', emoji: '💼' },
      ],
    } as never);
    const send = vi
      .spyOn(api, 'sendInvitation')
      .mockResolvedValue({ id: 'new' });
    render(<InvitationsHost />, { wrapper: AppWrapper });

    act(() =>
      useInvitations.getState().ask({
        spaceId: 'space-1',
        person: { user_id: 'u2', name: 'Ana Martin' },
      }),
    );
    const text = await screen.findByTestId('invite-dialog-text');
    expect(text.textContent).toContain('Ana Martin');

    await userEvent.selectOptions(
      screen.getByTestId('invite-dialog-room'),
      'room-2',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /^(Invite|Inviter)$/ }),
    );

    await waitFor(() => expect(send).toHaveBeenCalledWith('room-2', 'u2', ''));
    await waitFor(() =>
      expect(useInvitations.getState().outgoing[0]).toMatchObject({
        id: 'new',
        name: 'Ana Martin',
        roomId: 'room-2',
      }),
    );
    expect(useInvitations.getState().request).toBeUndefined();
  });

  it('does not offer the room the person is already in', async () => {
    vi.spyOn(api, 'useSpaceRooms').mockReturnValue({
      data: [
        { id: 'room-1', title: 'Design', emoji: '🎨' },
        { id: 'room-2', title: 'Bizdev', emoji: '💼' },
      ],
    } as never);
    render(<InvitationsHost />, { wrapper: AppWrapper });

    act(() =>
      useInvitations.getState().ask({
        spaceId: 'space-1',
        person: { user_id: 'u2', name: 'Ana Martin' },
        excludeRoomId: 'room-1',
      }),
    );

    const select = (await screen.findByTestId(
      'invite-dialog-room',
    )) as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual([
      'room-2',
    ]);
  });

  it('sends the reason written with the invitation and shows it to the person invited', async () => {
    vi.spyOn(api, 'useSpaceRooms').mockReturnValue({
      data: [{ id: 'room-1', title: 'Design', emoji: '🎨' }],
    } as never);
    const send = vi
      .spyOn(api, 'sendInvitation')
      .mockResolvedValue({ id: 'new' });
    render(<InvitationsHost />, { wrapper: AppWrapper });

    act(() =>
      useInvitations.getState().ask({
        spaceId: 'space-1',
        person: { user_id: 'u2', name: 'Ana Martin' },
      }),
    );
    await userEvent.type(
      await screen.findByTestId('invite-dialog-message'),
      '  Revue du lot 2  ',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /^(Invite|Inviter)$/ }),
    );
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith('room-1', 'u2', 'Revue du lot 2'),
    );
  });

  it('shows the reason of an invitation received, as plain text', async () => {
    render(<InvitationsHost />, { wrapper: AppWrapper });
    act(() =>
      useInvitations
        .getState()
        .receive({ ...invitation, message: '<b>Revue</b> du lot 2' }),
    );
    const reason = await screen.findByTestId('invitation-message-inv-1');
    expect(reason.textContent).toBe('<b>Revue</b> du lot 2');
    expect(reason.querySelector('b')).toBeNull();
  });
});
