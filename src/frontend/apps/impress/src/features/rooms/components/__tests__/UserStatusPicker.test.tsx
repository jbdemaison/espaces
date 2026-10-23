import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { UserStatusPicker } from '../UserStatusPicker';

const setStatus = vi.fn();
let current = { emoji: '', text: '', reachable: false };

vi.mock('../../api', () => ({
  useMyStatus: () => ({ data: current }),
  useSetMyStatus: () => ({ mutate: setStatus, isPending: false }),
}));

const open = async () =>
  userEvent.click(await screen.findByTestId('user-status-picker'));

describe('<UserStatusPicker />', () => {
  beforeAll(() => {
    Element.prototype.animate = vi.fn(
      () => ({ finished: Promise.resolve(), cancel: vi.fn() }) as never,
    );
  });

  beforeEach(() => {
    setStatus.mockReset();
    current = { emoji: '', text: '', reachable: false };
  });

  it('proposes suggestions, the custom status and the reachable switch', async () => {
    render(<UserStatusPicker />, { wrapper: AppWrapper });
    await open();

    expect(await screen.findByText('Available')).toBeTruthy();
    expect(screen.getByText('Do not disturb')).toBeTruthy();
    expect(screen.getByTestId('status-option-custom')).toBeTruthy();
    expect(screen.getByTestId('status-option-reachable')).toBeTruthy();
    // nothing to clear yet
    expect(screen.queryByTestId('status-option-clear')).toBeNull();
  });

  it('chooses a suggestion without touching reachability', async () => {
    render(<UserStatusPicker />, { wrapper: AppWrapper });
    await open();

    await userEvent.click(await screen.findByText('Do not disturb'));

    expect(setStatus).toHaveBeenCalledWith({
      emoji: '⛔',
      text: 'Do not disturb',
    });
  });

  it('switches "reachable" on whatever the situation', async () => {
    current = { emoji: '🎧', text: 'Focusing', reachable: false };
    render(<UserStatusPicker />, { wrapper: AppWrapper });
    await open();

    await userEvent.click(await screen.findByTestId('status-option-reachable'));

    expect(setStatus).toHaveBeenCalledWith({ reachable: true });
  });

  it('switches "reachable" off', async () => {
    current = { emoji: '', text: '', reachable: true };
    render(<UserStatusPicker />, { wrapper: AppWrapper });
    expect(screen.getByTestId('status-reachable-mark')).toBeTruthy();
    await open();

    await userEvent.click(await screen.findByTestId('status-option-reachable'));

    expect(setStatus).toHaveBeenCalledWith({ reachable: false });
  });

  it('clears the status', async () => {
    current = { emoji: '🎧', text: 'Focusing', reachable: true };
    render(<UserStatusPicker />, { wrapper: AppWrapper });
    await open();

    await userEvent.click(await screen.findByTestId('status-option-clear'));

    expect(setStatus).toHaveBeenCalledWith({ emoji: '', text: '' });
  });

  it('writes a custom status in a dialog', async () => {
    render(<UserStatusPicker />, { wrapper: AppWrapper });
    await open();
    await userEvent.click(await screen.findByTestId('status-option-custom'));

    const confirm = await screen.findByTestId('situation-confirm');
    expect(confirm.hasAttribute('disabled')).toBe(true);

    await userEvent.type(screen.getByTestId('situation-text'), 'Dans le train');
    await userEvent.click(screen.getByRole('button', { name: '🧠' }));
    await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false));
    await userEvent.click(confirm);

    expect(setStatus).toHaveBeenCalledWith(
      { emoji: '🧠', text: 'Dans le train' },
      expect.anything(),
    );
  });

  it('limits the text to 40 characters', async () => {
    render(<UserStatusPicker />, { wrapper: AppWrapper });
    await open();
    await userEvent.click(await screen.findByTestId('status-option-custom'));

    const input = (await screen.findByTestId(
      'situation-text',
    )) as HTMLInputElement;

    expect(input.maxLength).toBe(40);
  });
});
