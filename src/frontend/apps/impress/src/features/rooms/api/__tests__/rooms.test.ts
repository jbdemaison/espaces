import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  answerInvitation,
  getInboxAccess,
  getInvitationStatus,
  getRoomAccess,
  sendInvitation,
  withEmoji,
} from '..';

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

  it('unwraps the connection details of the personal inbox', async () => {
    const livekit = { url: 'ws://localhost:7880', room: 'inbox-1', token: 't' };
    fetchMock.post('http://test.jest/api/v1.0/user-inbox/', { livekit });

    await expect(getInboxAccess()).resolves.toEqual(livekit);
  });

  it('sends an invitation and returns its id', async () => {
    fetchMock.post('http://test.jest/api/v1.0/invitations/', {
      status: 201,
      body: { id: 'inv-1', expires_at: 1 },
    });

    await expect(sendInvitation('room', 'user')).resolves.toMatchObject({
      id: 'inv-1',
    });
    expect(
      JSON.parse(fetchMock.callHistory.lastCall()?.options.body as string),
    ).toEqual({ room_id: 'room', user_id: 'user', message: '' });
  });

  it('reports why an invitation was refused', async () => {
    fetchMock.post('http://test.jest/api/v1.0/invitations/', {
      status: 409,
      body: { code: 'busy' },
    });

    await expect(sendInvitation('room', 'user')).resolves.toEqual({
      refusal: 'busy',
    });
  });

  it('follows an invitation, and forgets one that is gone', async () => {
    fetchMock.get('http://test.jest/api/v1.0/invitations/a/', {
      status: 200,
      body: { status: 'unavailable' },
    });
    fetchMock.get('http://test.jest/api/v1.0/invitations/b/', 404);

    await expect(getInvitationStatus('a')).resolves.toBe('unavailable');
    await expect(getInvitationStatus('b')).resolves.toBeNull();
  });

  it('answers an invitation', async () => {
    fetchMock.post('http://test.jest/api/v1.0/invitations/a/answer/', {
      status: 200,
      body: { status: 'accepted', room_id: 'room' },
    });

    await expect(answerInvitation('a', 'accept')).resolves.toEqual({
      status: 'accepted',
      room_id: 'room',
    });
  });
});
