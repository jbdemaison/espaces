import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { Soundboard } from '../Soundboard';

const sendData = vi.fn();
let onData: (message: unknown) => void = () => undefined;

vi.mock('@livekit/components-react', () => ({
  useDataChannel: (_topic: string, callback: (message: unknown) => void) => {
    onData = callback;
    return { send: sendData };
  },
}));

const ID = '11111111-1111-4111-8111-111111111111';
const ROOM = '22222222-2222-4222-8222-222222222222';

const base = 'http://test.jest/api/v1.0';
const played: string[] = [];

describe('<Soundboard />', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    sendData.mockReset();
    played.length = 0;
    fetchMock.get(`${base}/documents/${ROOM}/sounds/`, {
      results: [
        { id: ID, name: 'Bravo', emoji: '👏', version: 1, can_delete: false },
      ],
      can_add: false,
      max_bytes: 307200,
      max_seconds: 5,
      max_count: 20,
    });
    fetchMock.get(`${base}/documents/${ROOM}/sounds/${ID}/`, {
      body: 'RIFF',
      headers: { 'Content-Type': 'audio/wav' },
    });
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    vi.stubGlobal(
      'Audio',
      class {
        volume = 1;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public src: string) {}
        play() {
          played.push(this.src);
          return Promise.resolve();
        }
        pause() {}
      },
    );
    localStorage.clear();
  });

  it('plays a sound here and tells the others when it is clicked', async () => {
    render(<Soundboard roomId={ROOM} />, { wrapper: AppWrapper });
    await userEvent.click(await screen.findByTestId('room-sounds-button'));
    await userEvent.click(await screen.findByTestId(`sound-${ID}`));

    await waitFor(() => expect(played).toEqual(['blob:fake']));
    expect(sendData).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(
      new TextDecoder().decode(sendData.mock.calls[0][0] as Uint8Array),
    ) as { soundId: string };
    expect(sent.soundId).toBe(ID);
    expect(screen.getByTestId('room-sound-notices')).toHaveTextContent('👏');
  });

  it('plays the sound of somebody else and shows their emoji', async () => {
    render(<Soundboard roomId={ROOM} />, { wrapper: AppWrapper });
    act(() =>
      onData({
        from: { identity: 'bob', name: 'Bob' },
        payload: new TextEncoder().encode(
          JSON.stringify({ soundId: ID, name: 'Bravo', emoji: '👏' }),
        ),
      }),
    );
    await waitFor(() => expect(played).toEqual(['blob:fake']));
    expect(screen.getByTestId('room-sound-notices')).toHaveTextContent('Bob');
  });

  it('ignores messages that do not carry a well-formed sound id', async () => {
    render(<Soundboard roomId={ROOM} />, { wrapper: AppWrapper });
    act(() =>
      onData({
        from: { identity: 'eve' },
        payload: new TextEncoder().encode(
          JSON.stringify({ soundId: '../../users/me', emoji: '💥' }),
        ),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(played).toEqual([]);
    expect(screen.getByTestId('room-sound-notices')).toBeEmptyDOMElement();
  });

  it('stays silent but still shows the emoji when the sounds are muted', async () => {
    localStorage.setItem(
      'espaces-sound-prefs',
      JSON.stringify({ volume: 0.5, muted: true }),
    );
    vi.resetModules();
    const { Soundboard: Fresh } = await import('../Soundboard');
    render(<Fresh roomId={ROOM} />, { wrapper: AppWrapper });
    act(() =>
      onData({
        from: { identity: 'bob', name: 'Bob' },
        payload: new TextEncoder().encode(
          JSON.stringify({ soundId: ID, name: 'Bravo', emoji: '👏' }),
        ),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(played).toEqual([]);
    expect(screen.getByTestId('room-sound-notices')).toHaveTextContent('👏');
  });

  it('hides the volume bar while a sound is being added', async () => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${base}/documents/${ROOM}/sounds/`, {
      results: [],
      can_add: true,
      max_bytes: 307200,
      max_seconds: 5,
      max_count: 20,
    });
    render(<Soundboard roomId={ROOM} />, { wrapper: AppWrapper });
    await userEvent.click(await screen.findByTestId('room-sounds-button'));
    expect(screen.getByRole('slider', { name: /volume/i })).toBeInTheDocument();

    await userEvent.click(await screen.findByTestId('sound-add-open'));
    expect(await screen.findByTestId('sound-add-form')).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /volume/i })).toBeNull();
  });
});
