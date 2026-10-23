import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import * as sounds from '../../api/sounds';
import { SoundAddForm } from '../SoundAddForm';

const decoded = (seconds: number) => ({
  sampleRate: 44100,
  length: seconds * 44100,
  duration: seconds,
  numberOfChannels: 1,
  getChannelData: () => new Float32Array(seconds * 44100).fill(0.3),
});

let seconds = 18;
vi.mock('../../utils/audioClip', async (original) => ({
  ...(await original<typeof import('../../utils/audioClip')>()),
  decodeFile: vi.fn(() => Promise.resolve(decoded(seconds))),
}));

const file = new File(['x'], 'bravo.mp3', { type: 'audio/mpeg' });

describe('<SoundAddForm />', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    seconds = 18;
  });

  it('offers emojis to pick instead of a field to type in', async () => {
    render(<SoundAddForm roomId="r" maxBytes={307200} onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });
    expect(
      screen.getAllByRole('button', { pressed: false }).length,
    ).toBeGreaterThan(10);
    await userEvent.click(screen.getByTestId('sound-emoji-🎉'));
    expect(screen.getByTestId('sound-emoji-🎉')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('sound-emoji-👏')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByRole('textbox', { name: /emoji/i })).toBeNull();
  });

  it('lets the person choose which 5 seconds of an 18 second file to keep', async () => {
    const add = vi.fn().mockResolvedValue({});
    vi.spyOn(sounds, 'useAddSound').mockReturnValue({
      mutateAsync: add,
    } as never);
    const onClose = vi.fn();
    render(<SoundAddForm roomId="r" maxBytes={307200} onClose={onClose} />, {
      wrapper: AppWrapper,
    });

    await userEvent.upload(screen.getByTestId('sound-file'), file);
    expect(await screen.findByTestId('sound-clip')).toBeInTheDocument();
    expect(screen.getByTestId('sound-range').textContent).toMatch(/0\.0.*5\.0/);
    // the name is suggested from the file name
    expect(screen.getByRole('textbox', { name: /name|nom/i })).toHaveValue(
      'bravo',
    );

    const start = screen.getByTestId('sound-start') as HTMLInputElement;
    expect(start.max).toBe('13');
    fireEvent.change(start, { target: { value: '3' } });
    await waitFor(() =>
      expect(screen.getByTestId('sound-range').textContent).toMatch(
        /3\.0.*8\.0/,
      ),
    );

    await userEvent.click(screen.getByTestId('sound-emoji-🔥'));
    await userEvent.click(
      screen.getByRole('button', { name: /^(Add|Ajouter)$/ }),
    );
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    const sent = add.mock.calls[0][0] as { emoji: string; file: File };
    expect(sent.emoji).toBe('🔥');
    expect(sent.file.type).toBe('audio/wav');
    // 5 seconds of mono 16-bit sound at 22.05 kHz
    expect(sent.file.size).toBe(44 + 5 * 22050 * 2);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('refuses a file longer than 20 seconds', async () => {
    seconds = 25;
    render(<SoundAddForm roomId="r" maxBytes={307200} onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });
    await userEvent.upload(screen.getByTestId('sound-file'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent(/20/);
    expect(screen.queryByTestId('sound-clip')).toBeNull();
  });
});
