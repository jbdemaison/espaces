import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { InactivityHost } from '../InactivityHost';

const setStatus = vi.fn();
let reachable = true;

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../../api', () => ({
  useMyStatus: () => ({
    data: { emoji: '🎧', text: 'Focus', reachable },
  }),
  useSetMyStatus: () => ({ mutate: setStatus }),
}));
vi.mock('../../utils/beep', () => ({ playInvitationBeep: vi.fn() }));

// short delays: 60 ms of inactivity, then 300 ms to answer
const host = <InactivityHost idleMs={60} confirmMs={300} checkMs={10} />;

describe('<InactivityHost />', () => {
  beforeAll(() => {
    Element.prototype.animate = vi.fn(
      () => ({ finished: Promise.resolve(), cancel: vi.fn() }) as never,
    );
  });

  beforeEach(() => {
    setStatus.mockClear();
    reachable = true;
  });

  it('asks a reachable person who stopped doing anything to confirm', async () => {
    render(host, { wrapper: AppWrapper });

    expect(await screen.findByTestId('still-reachable-text')).toBeTruthy();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('stays reachable when the person confirms', async () => {
    render(host, { wrapper: AppWrapper });

    await userEvent.click(await screen.findByTestId('still-reachable-confirm'));

    await waitFor(() =>
      expect(screen.queryByTestId('still-reachable-text')).toBeNull(),
    );
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('stops being reachable without an answer, keeping the situation', async () => {
    render(host, { wrapper: AppWrapper });

    await screen.findByTestId('still-reachable-text');
    await waitFor(
      () => expect(setStatus).toHaveBeenCalledWith({ reachable: false }),
      {
        timeout: 2000,
      },
    );
  });

  it('does nothing for people who are not reachable', async () => {
    reachable = false;
    render(host, { wrapper: AppWrapper });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.queryByTestId('still-reachable-text')).toBeNull();
    expect(setStatus).not.toHaveBeenCalled();
  });
});
