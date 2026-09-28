import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { defaultJellyfinClient } from '../jellyfin';
import { appConfig, saveUserToken } from '../shared/config';

describe('Web Auth Endpoints', () => {
  let originalConfig: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.simkl.client_id = 'mock-client-id';
    appConfig.simkl.client_secret = 'mock-client-secret';
    appConfig.simkl.redirect_uri = 'http://localhost:3000/auth/callback';
    appConfig.simkl.users = {
      testuser: 'test-token-123',
    };
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
    mock.restore();
  });

  test('saveUserToken should save token to in-memory config and file', async () => {
    const originalWrite = Bun.write;
    let writtenContent = '';
    Bun.write = mock((path: any, data: any) => {
      writtenContent = String(data);
      return Promise.resolve(writtenContent.length);
    }) as any;

    try {
      // Test updating an in-memory user
      await saveUserToken('testuser', 'new-token-456');
      expect(appConfig.simkl.users.testuser).toBe('new-token-456');
      expect(writtenContent).toContain('testuser = "new-token-456"');

      // Test adding a brand new user
      await saveUserToken('newuser', 'newuser-token-789');
      expect(appConfig.simkl.users.newuser).toBe('newuser-token-789');
      expect(writtenContent).toContain('newuser = "newuser-token-789"');

      // Test saving full token object with refresh_token and expires_at
      await saveUserToken('oauthuser', {
        token: 'access-abc',
        refresh_token: 'refresh-xyz',
        expires_at: 1728000000000,
      });
      expect(appConfig.simkl.users.oauthuser).toEqual({
        token: 'access-abc',
        refresh_token: 'refresh-xyz',
        expires_at: 1728000000000,
      });
      expect(writtenContent).toContain(
        'oauthuser = { token = "access-abc", refresh_token = "refresh-xyz", expires_at = 1728000000000 }',
      );
    } finally {
      Bun.write = originalWrite;
    }
  });

  test('defaultJellyfinClient.getUsers should return user list or empty array', async () => {
    const fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { Id: 'user-1', Name: 'Alice' },
            { Id: 'user-2', Name: 'Bob' },
          ]),
        ),
      );
    });
    global.fetch = fetchMock as any;

    const users = await defaultJellyfinClient.getUsers();
    expect(users).toEqual([
      { id: 'user-1', name: 'Alice' },
      { id: 'user-2', name: 'Bob' },
    ]);
  });
});
