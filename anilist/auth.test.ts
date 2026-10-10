import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { appConfig } from '../shared/config';
import {
  consumeAniListOAuthSession,
  createAniListOAuthSession,
  exchangeCodeForAniListToken,
  getAniListAuthUrl,
  getAniListUserToken,
  validateAniListUserToken,
} from './auth';

describe('AniList Auth Module', () => {
  let originalConfig: any;
  let fetchMock: any;
  let originalWrite: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.anilist = {
      client_id: '12345',
      client_secret: 'anilist-client-secret',
      redirect_uri: 'http://localhost:3000/auth/anilist/callback',
      users: {},
    };
    originalWrite = Bun.write;
    Bun.write = mock(() => Promise.resolve(100)) as any;
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
    Bun.write = originalWrite;
    mock.restore();
  });

  test('getAniListAuthUrl should construct valid OAuth URL with client_id and state', () => {
    const { url, state } = getAniListAuthUrl(
      'testuser',
      'http://localhost:3000/auth/anilist/callback',
    );
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://anilist.co');
    expect(parsed.pathname).toBe('/api/v2/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('12345');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/auth/anilist/callback',
    );
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe(state);
  });

  test('getAniListAuthUrl should throw if client_id is missing', () => {
    delete appConfig.anilist?.client_id;
    expect(() =>
      getAniListAuthUrl('testuser', 'http://localhost:3000/auth/anilist/callback'),
    ).toThrow('AniList client_id is not configured in config.toml');
  });

  test('createAniListOAuthSession and consumeAniListOAuthSession should manage active sessions', () => {
    const { state } = createAniListOAuthSession(
      'alice',
      'http://localhost:3000/auth/anilist/callback',
    );
    expect(state).toBeDefined();

    const session = consumeAniListOAuthSession(state);
    expect(session).not.toBeNull();
    expect(session?.username).toBe('alice');
    expect(session?.redirectUri).toBe('http://localhost:3000/auth/anilist/callback');

    // Should only be consumable once
    const secondTry = consumeAniListOAuthSession(state);
    expect(secondTry).toBeNull();
  });

  test('exchangeCodeForAniListToken should POST JSON payload to https://anilist.co/api/v2/oauth/token', async () => {
    fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            token_type: 'Bearer',
            expires_in: 31536000,
            access_token: 'mock-anilist-token-abc',
          }),
        ),
      );
    });
    global.fetch = fetchMock as any;

    const result = await exchangeCodeForAniListToken(
      'code-123',
      'http://localhost:3000/auth/anilist/callback',
    );
    expect(result.accessToken).toBe('mock-anilist-token-abc');
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(31536000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe('https://anilist.co/api/v2/oauth/token');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.client_id).toBe(12345);
    expect(body.client_secret).toBe('anilist-client-secret');
    expect(body.code).toBe('code-123');
    expect(body.redirect_uri).toBe('http://localhost:3000/auth/anilist/callback');
    expect(body.grant_type).toBe('authorization_code');
  });

  test('validateAniListUserToken should return true and username when Viewer GraphQL query succeeds', async () => {
    fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              Viewer: {
                id: 9988,
                name: 'mock_user',
              },
            },
          }),
        ),
      );
    });
    global.fetch = fetchMock as any;

    const status = await validateAniListUserToken('valid-token');
    expect(status.valid).toBe(true);
    expect(status.anilistUsername).toBe('mock_user');
    expect(status.anilistUserId).toBe(9988);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe('https://graphql.anilist.co');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer valid-token');
    const body = JSON.parse(options.body);
    expect(body.query).toContain('Viewer');
  });

  test('validateAniListUserToken should return false when response is 401', async () => {
    fetchMock = mock(() => {
      return Promise.resolve(new Response('Unauthorized', { status: 401 }));
    });
    global.fetch = fetchMock as any;

    const status = await validateAniListUserToken('expired-token');
    expect(status.valid).toBe(false);
    expect(status.error).toContain('Token expired or invalid');
  });

  test('validateAniListUserToken should return false when GraphQL returns error', async () => {
    fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            errors: [{ message: 'Invalid token' }],
          }),
        ),
      );
    });
    global.fetch = fetchMock as any;

    const status = await validateAniListUserToken('invalid-token');
    expect(status.valid).toBe(false);
    expect(status.error).toBe('Invalid token');
  });

  test('getAniListUserToken should return valid token or null if expired or missing', () => {
    appConfig.anilist = {
      users: {
        activeUser: {
          token: 'token-active',
          expires_at: Date.now() + 10000000,
        },
        expiredUser: {
          token: 'token-expired',
          expires_at: Date.now() - 1000,
        },
        stringUser: 'token-str',
      },
    };

    expect(getAniListUserToken('activeUser')).toBe('token-active');
    expect(getAniListUserToken('expiredUser')).toBeNull();
    expect(getAniListUserToken('stringUser')).toBe('token-str');
    expect(getAniListUserToken('nonexistent')).toBeNull();
  });
});
