import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import * as api from '../../api';
import { useInvitations } from '../../stores/useInvitations';
import { ReachableChannel } from '../ReachableChannel';

let onData: (payload: Uint8Array) => void = () => undefined;
const connect = vi.fn();

vi.mock('livekit-client', () => ({
  RoomEvent: { DataReceived: 'dataReceived' },
  Room: class {
    state = 'connected';
    on(event: string, callback: (payload: Uint8Array) => void) {
      if (event === 'dataReceived') {
        onData = callback;
      }
    }
    connect = connect;
    disconnect = vi.fn();
  },
}));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));

describe('<ReachableChannel />', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    connect.mockReset().mockResolvedValue(undefined);
    useInvitations.setState({ request: undefined, incoming: [], outgoing: [] });
    vi.spyOn(api, 'useMyStatus').mockReturnValue({
      data: { emoji: '', text: '', reachable: true },
    } as never);
    vi.spyOn(api, 'getInboxAccess').mockResolvedValue({
      url: 'ws://lk',
      token: 't',
    } as never);
  });

  it('confirms that the inbox works once the connection is complete', async () => {
    const ready = vi.spyOn(api, 'markInboxReady').mockResolvedValue();
    render(<ReachableChannel />, { wrapper: AppWrapper });

    await waitFor(() =>
      expect(connect).toHaveBeenCalledWith('ws://lk', 't', {
        autoSubscribe: false,
      }),
    );
    await waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
  });

  it('does not confirm anything while the connection fails', async () => {
    connect.mockRejectedValue(new Error('could not establish pc connection'));
    const ready = vi.spyOn(api, 'markInboxReady').mockResolvedValue();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<ReachableChannel />, { wrapper: AppWrapper });

    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(ready).not.toHaveBeenCalled();
  });

  it('hands a received invitation, with its reason, to the store', async () => {
    vi.spyOn(api, 'markInboxReady').mockResolvedValue();
    render(<ReachableChannel />, { wrapper: AppWrapper });
    await waitFor(() => expect(connect).toHaveBeenCalled());

    act(() =>
      onData(
        new TextEncoder().encode(
          JSON.stringify({
            type: 'invitation',
            id: 'inv-1',
            from: { user_id: 'u1', name: 'Alice' },
            room: { id: 'r1', title: 'Design', emoji: '🎨' },
            space: { id: 's1', title: 'Lab', emoji: '🧪' },
            message: 'On y va',
          }),
        ),
      ),
    );
    expect(useInvitations.getState().incoming[0]).toMatchObject({
      id: 'inv-1',
      message: 'On y va',
    });
  });
});
