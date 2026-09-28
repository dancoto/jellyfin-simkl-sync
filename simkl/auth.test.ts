import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { appConfig } from '../shared/config';
import {
  consumeOAuthSession,
  createOAuthSession,
  exchangeCodeForToken,
  getOrRefreshUserToken,
  getSimklAuthUrl,
  refreshUserToken,
  validateUserToken,
} from './auth';

describe('Simkl Auth Module (OAuth 2.0 / AUTH V2)', () => {
  let originalConfig: any;
  let fetchMock: any;
  let originalWrite: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.simkl.client_id = 'test-client-id';
    appConfig.simkl.client_secret = 'test-client-secret';
    appConfig.simkl.app_name = 'test-app';
    originalWrite = Bun.write;
    Bun.write = mock(() => Promise.resolve(100)) as any;
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
    Bun.write = originalWrite;
    mock.restore();
  });

  test('getSimklAuthUrl should construct valid OAuth 2.0 authorization URL with PKCE', () => {
    const { url, state } = getSimklAuthUrl('daniel', 'http://localhost:3000/auth/callback');
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://simkl.com');
    expect(parsed.pathname).toBe('/oauth2/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/callback');
    expect(parsed.searchParams.get('scope')).toBe('media:read media:write');
    expect(parsed.searchParams.get('state')).toBe(state);
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBeDefined();
    expect(parsed.searchParams.get('code_challenge')?.length).toBeGreaterThan(40);
  });

  test('createOAuthSession and consumeOAuthSession should manage active sessions', () => {
    const { state, verifier } = createOAuthSession('alice', 'http://localhost:3000/auth/callback');
    expect(state).toBeDefined();
    expect(verifier).toBeDefined();

    const session = consumeOAuthSession(state);
    expect(session).not.toBeNull();
    expect(session?.username).toBe('alice');
    expect(session?.verifier).toBe(verifier);

    // Should only be consumable once
    const secondTry = consumeOAuthSession(state);
    expect(secondTry).toBeNull();
  });

  test('exchangeCodeForToken should post to https://api.simkl.com/oauth2/token with code_verifier', async () => {
    fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'mock-user-token-abc',
            refresh_token: 'mock-refresh-xyz',
            expires_in: 604800,
            token_type: 'bearer',
            scope: 'media:read media:write',
          }),
        ),
      );
    });
    global.fetch = fetchMock as any;

    const result = await exchangeCodeForToken(
      'auth-code-123',
      'http://localhost:3000/auth/callback',
      'test-code-verifier-456',
    );
    expect(result.accessToken).toBe('mock-user-token-abc');
    expect(result.refreshToken).toBe('mock-refresh-xyz');
    expect(result.expiresIn).toBe(604800);
    expect(result.scope).toBe('media:read media:write');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe('https://api.simkl.com/oauth2/token');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const params = new URLSearchParams(options.body);
    expect(params.get('client_id')).toBe('test-client-id');
    expect(params.get('client_secret')).toBe('test-client-secret');
    expect(params.get('code')).toBe('auth-code-123');
    expect(params.get('code_verifier')).toBe('test-code-verifier-456');
    expect(params.get('grant_type')).toBe('authorization_code');
  });

  test('validateUserToken should return true and username when token is valid', async () => {
    fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            user: { name: 'daniel_simkl' },
          }),
        ),
      );
    });
    global.fetch = fetchMock as any;

    const status = await validateUserToken('valid-token');
    expect(status.valid).toBe(true);
    expect(status.simklUsername).toBe('daniel_simkl');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain('https://api.simkl.com/users/settings');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer valid-token');
  });

  test('validateUserToken should return false when token returns 401', async () => {
    fetchMock = mock(() => {
      return Promise.resolve(new Response('Unauthorized', { status: 401 }));
    });
    global.fetch = fetchMock as any;

    const status = await validateUserToken('expired-token');
    expect(status.valid).toBe(false);
    expect(status.error).toContain('expired or invalid');
  });

  test('refreshUserToken should exchange refresh_token for new access token and save', async () => {
    appConfig.simkl.users = {
      testuser: {
        token: 'old-access-token',
        refresh_token: 'valid-refresh-token',
        expires_at: Date.now() - 1000, // expired
      },
    };

    fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'valid-refresh-token',
            expires_in: 604800,
          }),
        ),
      );
    });
    global.fetch = fetchMock as any;

    const newToken = await refreshUserToken('testuser');
    expect(newToken).toBe('new-access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe('https://api.simkl.com/oauth2/token');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const params = new URLSearchParams(options.body);
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('valid-refresh-token');
    expect(params.get('client_id')).toBe('test-client-id');
    expect(params.get('client_secret')).toBe('test-client-secret');

    // Confirm updated in config
    const updated = appConfig.simkl.users.testuser as any;
    expect(updated.token).toBe('new-access-token');
    expect(updated.expires_at).toBeGreaterThan(Date.now());
  });

  test('getOrRefreshUserToken should return string token directly', async () => {
    appConfig.simkl.users = {
      legacyuser: 'legacy-token-string',
    };

    const token = await getOrRefreshUserToken('legacyuser');
    expect(token).toBe('legacy-token-string');
  });

  test('getOrRefreshUserToken should return existing valid token without refreshing', async () => {
    fetchMock = mock(() => Promise.resolve(new Response('{}')));
    global.fetch = fetchMock as any;

    appConfig.simkl.users = {
      freshuser: {
        token: 'current-valid-token',
        refresh_token: 'some-refresh',
        expires_at: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days left
      },
    };

    const token = await getOrRefreshUserToken('freshuser');
    expect(token).toBe('current-valid-token');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  test('getOrRefreshUserToken should auto-refresh if token expires within 24 hours', async () => {
    appConfig.simkl.users = {
      expiringuser: {
        token: 'expiring-token',
        refresh_token: 'expiring-refresh',
        expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes left
      },
    };

    fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'auto-refreshed-token',
            refresh_token: 'expiring-refresh',
            expires_in: 604800,
          }),
        ),
      );
    });
    global.fetch = fetchMock as any;

    const token = await getOrRefreshUserToken('expiringuser');
    expect(token).toBe('auto-refreshed-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
