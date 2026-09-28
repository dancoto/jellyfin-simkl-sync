import { createHash, randomBytes } from 'node:crypto';
import {
  appConfig,
  extractUserAccessToken,
  saveUserToken,
  type UserTokenEntry,
} from '../shared/config';

export interface UserAuthStatus {
  username: string;
  isConfigured: boolean;
  isValid: boolean;
  simklUsername?: string;
  expiresInDays?: number;
  hasRefreshToken: boolean;
  error?: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}

export interface OAuthSession {
  username: string;
  verifier: string;
  redirectUri: string;
  createdAt: number;
}

const oauthSessions = new Map<string, OAuthSession>();

const cleanupExpiredSessions = () => {
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  for (const [state, session] of oauthSessions.entries()) {
    if (session.createdAt < fifteenMinutesAgo) {
      oauthSessions.delete(state);
    }
  }
};

/**
 * Creates and stores an in-memory OAuth session with PKCE verifier and challenge.
 */
export const createOAuthSession = (
  username: string,
  redirectUri: string,
): { state: string; verifier: string; challenge: string } => {
  cleanupExpiredSessions();
  const state = randomBytes(16).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  oauthSessions.set(state, {
    username,
    verifier,
    redirectUri,
    createdAt: Date.now(),
  });

  return { state, verifier, challenge };
};

/**
 * Consumes and removes an active OAuth session by its state identifier.
 */
export const consumeOAuthSession = (state: string): OAuthSession | null => {
  cleanupExpiredSessions();
  const session = oauthSessions.get(state);
  if (session) {
    oauthSessions.delete(state);
    return session;
  }
  return null;
};

/**
 * Builds the Simkl OAuth 2.0 (AUTH V2) authorization URL with PKCE parameters.
 * Endpoint: https://simkl.com/oauth2/authorize
 * Scopes: media:read media:write
 */
export const getSimklAuthUrl = (
  username: string,
  redirectUri: string,
): { url: string; state: string } => {
  const clientId = appConfig.simkl.client_id;
  if (!clientId) {
    throw new Error('Simkl client_id is not configured in config.toml');
  }

  const { state, challenge } = createOAuthSession(username, redirectUri);

  const url = new URL('https://simkl.com/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'media:read media:write');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return { url: url.toString(), state };
};

/**
 * Exchanges the temporary authorization code returned by Simkl for access and refresh tokens.
 * Endpoint: POST https://api.simkl.com/oauth2/token
 */
export const exchangeCodeForToken = async (
  code: string,
  redirectUri: string,
  verifier: string,
): Promise<TokenExchangeResult> => {
  const clientId = appConfig.simkl.client_id;
  const clientSecret = appConfig.simkl.client_secret;

  if (!clientId) {
    throw new Error('Simkl client_id must be configured in config.toml to exchange OAuth codes.');
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  if (clientSecret) {
    params.set('client_secret', clientSecret);
  }

  const response = await fetch('https://api.simkl.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': `${appConfig.simkl.app_name || 'jellyfin-simkl-sync'}/2.0`,
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Simkl OAuth token exchange failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };

  if (!data.access_token) {
    throw new Error(`Simkl did not return an access token: ${JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
};

/**
 * Refreshes an expired or near-expiry token for a given user using their refresh_token.
 * Endpoint: POST https://api.simkl.com/oauth2/token
 */
export const refreshUserToken = async (username: string): Promise<string> => {
  const userEntry = appConfig.simkl.users[username];
  const refreshToken =
    typeof userEntry === 'object' && userEntry ? userEntry.refresh_token : undefined;

  if (!refreshToken) {
    throw new Error(`User "${username}" does not have a refresh token configured.`);
  }

  const clientId = appConfig.simkl.client_id;
  const clientSecret = appConfig.simkl.client_secret;

  if (!clientId) {
    throw new Error('Simkl client_id must be configured in config.toml to refresh tokens.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });

  if (clientSecret) {
    params.set('client_secret', clientSecret);
  }

  const response = await fetch('https://api.simkl.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': `${appConfig.simkl.app_name || 'jellyfin-simkl-sync'}/2.0`,
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to refresh Simkl token for "${username}" (HTTP ${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error(`Simkl refresh response missing access_token for user "${username}"`);
  }

  // Refresh token stays the same in Simkl Auth V2, but if a new one is returned, use it
  const newRefreshToken = data.refresh_token || refreshToken;
  const expiresInSeconds = data.expires_in ?? 7 * 24 * 60 * 60; // 7 days default
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  await saveUserToken(username, {
    token: data.access_token,
    refresh_token: newRefreshToken,
    expires_at: expiresAt,
  });

  console.log(`Successfully refreshed Simkl access token for user "${username}".`);
  return data.access_token;
};

/**
 * Retrieves a valid access token for a user, automatically refreshing it if it is within 24 hours of expiry.
 */
export const getOrRefreshUserToken = async (username: string): Promise<string | null> => {
  const entry = appConfig.simkl.users[username];
  if (!entry) {
    return null;
  }

  if (typeof entry === 'string') {
    return entry;
  }

  // If entry has a refresh token and expires within 24 hours (or already expired), refresh now
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (entry.refresh_token) {
    const isExpiringSoon = !entry.expires_at || Date.now() + ONE_DAY_MS >= entry.expires_at;
    if (isExpiringSoon) {
      console.log(
        `Simkl access token for user "${username}" is nearing expiration. Refreshing now...`,
      );
      try {
        return await refreshUserToken(username);
      } catch (err) {
        console.error(`Error auto-refreshing token for "${username}":`, err);
        // Fallback to attempting with existing token
        return entry.token;
      }
    }
  }

  return entry.token;
};

/**
 * Validates a user's token by querying their Simkl user profile/settings.
 * Endpoint: GET https://api.simkl.com/users/settings?client_id=...&app-name=...&app-version=2.0
 */
export const validateUserToken = async (
  tokenOrEntry: UserTokenEntry | undefined,
): Promise<{ valid: boolean; simklUsername?: string; error?: string }> => {
  const userToken = extractUserAccessToken(tokenOrEntry);
  if (!userToken) {
    return { valid: false, error: 'No token configured' };
  }

  const clientId = appConfig.simkl.client_id;
  const appName = appConfig.simkl.app_name || 'jellyfin-simkl-sync';

  try {
    const url = new URL('https://api.simkl.com/users/settings');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('app-name', appName);
    url.searchParams.set('app-version', '2.0');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'User-Agent': `${appName}/2.0`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        user?: { name?: string };
        account?: { id?: number };
      };
      const simklUsername =
        data.user?.name ?? (data.account?.id ? String(data.account.id) : 'Connected');
      return { valid: true, simklUsername };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Token expired or invalid' };
    }

    return { valid: false, error: `Simkl returned HTTP ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
