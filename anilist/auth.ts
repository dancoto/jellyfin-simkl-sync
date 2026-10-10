import { randomBytes } from 'node:crypto';
import {
  appConfig,
  extractUserAccessToken,
  saveAniListUserToken,
  type UserTokenEntry,
} from '../shared/config';

export interface AniListUserAuthStatus {
  username: string;
  isConfigured: boolean;
  isValid: boolean;
  anilistUsername?: string;
  anilistUserId?: number;
  expiresInDays?: number;
  error?: string;
}

export interface AniListTokenExchangeResult {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface AniListOAuthSession {
  username: string;
  redirectUri: string;
  createdAt: number;
}

const anilistOAuthSessions = new Map<string, AniListOAuthSession>();

const cleanupExpiredSessions = () => {
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  for (const [state, session] of anilistOAuthSessions.entries()) {
    if (session.createdAt < fifteenMinutesAgo) {
      anilistOAuthSessions.delete(state);
    }
  }
};

/**
 * Creates and stores an in-memory OAuth session for AniList authorization.
 */
export const createAniListOAuthSession = (
  username: string,
  redirectUri: string,
): { state: string } => {
  cleanupExpiredSessions();
  const state = randomBytes(16).toString('base64url');

  anilistOAuthSessions.set(state, {
    username,
    redirectUri,
    createdAt: Date.now(),
  });

  return { state };
};

/**
 * Consumes and removes an active AniList OAuth session by its state identifier.
 */
export const consumeAniListOAuthSession = (state: string): AniListOAuthSession | null => {
  cleanupExpiredSessions();
  const session = anilistOAuthSessions.get(state);
  if (session) {
    anilistOAuthSessions.delete(state);
    return session;
  }
  return null;
};

/**
 * Builds the AniList OAuth 2.0 authorization URL.
 * Endpoint: https://anilist.co/api/v2/oauth/authorize
 */
export const getAniListAuthUrl = (
  username: string,
  redirectUri: string,
): { url: string; state: string } => {
  const clientId = appConfig.anilist?.client_id;
  if (!clientId) {
    throw new Error('AniList client_id is not configured in config.toml');
  }

  const { state } = createAniListOAuthSession(username, redirectUri);

  const url = new URL('https://anilist.co/api/v2/oauth/authorize');
  url.searchParams.set('client_id', String(clientId));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  return { url: url.toString(), state };
};

/**
 * Exchanges the temporary authorization code returned by AniList for an access token.
 * Endpoint: POST https://anilist.co/api/v2/oauth/token
 */
export const exchangeCodeForAniListToken = async (
  code: string,
  redirectUri: string,
): Promise<AniListTokenExchangeResult> => {
  const clientId = appConfig.anilist?.client_id;
  const clientSecret = appConfig.anilist?.client_secret;

  if (!clientId || !clientSecret) {
    throw new Error(
      'AniList client_id and client_secret must both be configured in config.toml to exchange OAuth codes.',
    );
  }

  const numClientId = Number(clientId);
  const formattedClientId =
    !isNaN(numClientId) && Number.isInteger(numClientId) ? numClientId : clientId;

  const response = await fetch('https://anilist.co/api/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: formattedClientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AniList OAuth token exchange failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    token_type?: string;
    expires_in?: number;
    access_token?: string;
    error?: string;
    message?: string;
  };

  if (!data.access_token) {
    throw new Error(`AniList did not return an access token: ${JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  };
};

/**
 * Validates a user's AniList access token by querying the authenticated Viewer.
 * Endpoint: POST https://graphql.anilist.co
 */
export const validateAniListUserToken = async (
  tokenOrEntry: UserTokenEntry | undefined,
): Promise<{
  valid: boolean;
  anilistUsername?: string;
  anilistUserId?: number;
  error?: string;
}> => {
  const userToken = extractUserAccessToken(tokenOrEntry);
  if (!userToken) {
    return { valid: false, error: 'No token configured' };
  }

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: 'query { Viewer { id name } }',
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        data?: {
          Viewer?: {
            id?: number;
            name?: string;
          };
        };
        errors?: Array<{ message?: string }>;
      };

      if (data.data?.Viewer?.name) {
        return {
          valid: true,
          anilistUsername: data.data.Viewer.name,
          anilistUserId: data.data.Viewer.id,
        };
      }

      if (data.errors && data.errors.length > 0) {
        return { valid: false, error: data.errors[0]?.message || 'GraphQL error' };
      }

      return { valid: false, error: 'Viewer profile not returned' };
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Token expired or invalid' };
    }

    return { valid: false, error: `AniList returned HTTP ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Retrieves a valid access token for a user, returning null if not configured or expired.
 */
export const getAniListUserToken = (username: string): string | null => {
  const entry = appConfig.anilist?.users?.[username];
  if (!entry) {
    return null;
  }

  if (typeof entry === 'object' && entry.expires_at) {
    if (Date.now() >= entry.expires_at) {
      console.warn(
        `AniList access token for "${username}" has expired. User must re-authenticate.`,
      );
      return null;
    }
  }

  return extractUserAccessToken(entry);
};

export { saveAniListUserToken };
