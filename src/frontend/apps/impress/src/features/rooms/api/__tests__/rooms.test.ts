import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { getRoomAccess, withEmoji } from '..';

const base = 'http://test.jest/api/v1.0/documents';

describe('rooms api', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('puts the emoji in front of the title, as Docs does', () => {
    expect(withEmoji('Salon', '💬')).toBe('💬 Salon');
    expect(withEmoji('Salon', '')).toBe('Salon');
  });

  it('unwraps the connection details of the answer', async () => {
    const livekit = { url: 'ws://localhost:7880', room: 'r', token: 't' };
    fetchMock.post(`${base}/abc/room-access/`, { livekit, abilities: {} });

    await expect(getRoomAccess('abc')).resolves.toEqual(livekit);
  });
});
