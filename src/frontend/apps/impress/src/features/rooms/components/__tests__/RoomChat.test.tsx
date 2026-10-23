import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { RoomChat } from '../RoomChat';

const sendData = vi.fn();
const sendChat = vi.fn();
let onData: (message: unknown) => void = () => undefined;

vi.mock('@livekit/components-react', () => ({
  useRoomContext: () => ({ localParticipant: { identity: 'me' } }),
  useChat: () => ({
    isSending: false,
    send: sendChat,
    chatMessages: [
      {
        id: 'm1',
        timestamp: Date.now(),
        message: 'Bonjour tout le monde',
        from: { identity: 'bob', name: 'Bob', isLocal: false },
      },
    ],
  }),
  useDataChannel: (_topic: string, callback: (message: unknown) => void) => {
    onData = callback;
    return { send: sendData };
  },
}));

const reactionFrom = (identity: string, emoji: string, on: boolean) => ({
  from: { identity },
  payload: new TextEncoder().encode(
    JSON.stringify({ messageId: 'm1', emoji, on }),
  ),
});

describe('<RoomChat />', () => {
  beforeEach(() => {
    sendData.mockClear();
    sendChat.mockClear();
  });

  it('writes "Envoyer" on the send button and sends the message', async () => {
    render(<RoomChat />, { wrapper: AppWrapper });

    await userEvent.type(screen.getByTestId('room-chat-input'), 'Salut');
    await userEvent.click(screen.getByRole('button', { name: /Send|Envoyer/ }));

    expect(sendChat).toHaveBeenCalledWith('Salut');
  });

  it('offers positive emojis only, adds a reaction and takes it back', async () => {
    render(<RoomChat />, { wrapper: AppWrapper });

    await userEvent.click(screen.getByTestId('chat-react-m1'));
    const menu = screen.getByRole('menu');
    const offered = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent);
    expect(offered).toContain('👍');
    expect(offered).not.toContain('👎');

    await userEvent.click(within(menu).getByText('👍'));
    const chip = screen.getByTestId('chat-chip-m1-👍');
    expect(chip.textContent).toContain('1');
    expect(sendData).toHaveBeenCalledTimes(1);

    await userEvent.click(chip);
    expect(screen.queryByTestId('chat-chip-m1-👍')).toBeNull();
    expect(sendData).toHaveBeenCalledTimes(2);
  });

  it('counts the reactions of the others, and ignores unknown emojis', () => {
    render(<RoomChat />, { wrapper: AppWrapper });

    act(() => onData(reactionFrom('bob', '🎉', true)));
    act(() => onData(reactionFrom('ana', '🎉', true)));
    act(() => onData(reactionFrom('ana', '💩', true)));

    expect(screen.getByTestId('chat-chip-m1-🎉').textContent).toContain('2');
    expect(screen.queryByTestId('chat-chip-m1-💩')).toBeNull();
  });
});
