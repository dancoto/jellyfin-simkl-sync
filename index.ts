import { defaultAnimeResolver } from './anime';
import { renderAuthHtml } from './auth/page';
import { defaultJellyfinClient, type RawJellyfinPayload } from './jellyfin';
import { handleWebhook } from './main';
import { appConfig, saveUserToken } from './shared/config';
import {
  consumeOAuthSession,
  exchangeCodeForToken,
  getSimklAuthUrl,
  refreshUserToken,
  validateUserToken,
} from './simkl/auth';
import { flushAllQueues } from './simkl/batcher';

import { initLogger } from './shared/logger';

// Initialize configurable logger
initLogger();

// Proactively check and refresh any tokens expiring within 48 hours
export const checkAndRefreshExpiringTokens = async () => {
  const users = appConfig.simkl.users || {};
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  for (const [username, entry] of Object.entries(users)) {
    if (typeof entry === 'object' && entry?.refresh_token && entry?.expires_at) {
      if (Date.now() + TWO_DAYS_MS >= entry.expires_at) {
        console.log(
          `Simkl access token for "${username}" is nearing expiration. Refreshing now...`,
        );
        try {
          await refreshUserToken(username);
        } catch (err) {
          console.error(`Background token refresh failed for "${username}":`, err);
        }
      }
    }
  }
};

// Initialize anime mapping resolver and token refresh check on startup
defaultAnimeResolver.initialize().catch((error) => {
  console.error('Failed to initialize anime resolver on startup:', error);
});
checkAndRefreshExpiringTokens().catch((error) => {
  console.error('Failed checking expiring tokens on startup:', error);
});

// Automatically check and refresh expired mapping caches & user tokens every 24 hours
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  console.log('Running scheduled daily check for anime mapping updates & token refresh...');
  defaultAnimeResolver.initialize().catch((error) => {
    console.error('Failed to refresh anime mappings in background:', error);
  });
  checkAndRefreshExpiringTokens().catch((error) => {
    console.error('Failed to auto-refresh expiring user tokens in background:', error);
  });
}, TWENTY_FOUR_HOURS_MS);

const getRedirectUri = (req: Request): string => {
  if (appConfig.simkl.redirect_uri) {
    return appConfig.simkl.redirect_uri;
  }
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const proto =
    req.headers.get('x-forwarded-proto') || (url.protocol.startsWith('https') ? 'https' : 'http');
  return `${proto}://${host}/auth/callback`;
};

const handleAuthPage = (req: Request) => {
  const url = new URL(req.url);
  const redirectUri = getRedirectUri(req);
  const successUser = url.searchParams.get('success') ?? undefined;
  const errorMessage = url.searchParams.get('error') ?? undefined;

  const html = renderAuthHtml({
    clientId: appConfig.simkl.client_id,
    hasClientSecret: Boolean(appConfig.simkl.client_secret),
    redirectUri,
    successUser,
    errorMessage,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

const server = Bun.serve({
  port: 3000,
  routes: {
    '/': {
      GET: handleAuthPage,
    },
    '/auth': {
      GET: handleAuthPage,
    },
    '/api/users': {
      GET: async () => {
        const jfUsers = await defaultJellyfinClient.getUsers();
        const allUsernames = new Set<string>();

        for (const u of jfUsers) {
          allUsernames.add(u.name);
        }
        for (const u of Object.keys(appConfig.simkl.users || {})) {
          allUsernames.add(u);
        }

        const userStatuses = await Promise.all(
          Array.from(allUsernames).map(async (username) => {
            let entry = appConfig.simkl.users[username];
            if (!entry) {
              return {
                username,
                isConfigured: false,
                isValid: false,
                hasRefreshToken: false,
              };
            }

            // Proactively auto-refresh if expired or within 24 hours
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;
            if (typeof entry === 'object' && entry?.refresh_token && entry?.expires_at) {
              if (Date.now() + ONE_DAY_MS >= entry.expires_at) {
                try {
                  await refreshUserToken(username);
                  entry = appConfig.simkl.users[username];
                } catch (e) {
                  console.error(`Auto-refresh during status check failed for "${username}":`, e);
                }
              }
            }

            const check = await validateUserToken(entry);
            let expiresInDays: number | undefined;
            const hasRefreshToken = typeof entry === 'object' && Boolean(entry?.refresh_token);

            if (typeof entry === 'object' && entry?.expires_at) {
              const diffMs = entry.expires_at - Date.now();
              expiresInDays = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
            }

            return {
              username,
              isConfigured: true,
              isValid: check.valid,
              simklUsername: check.simklUsername,
              expiresInDays,
              hasRefreshToken,
              error: check.error,
            };
          }),
        );

        return Response.json({
          jellyfinUsers: jfUsers,
          users: userStatuses,
        });
      },
    },
    '/api/users/refresh': {
      POST: async (req) => {
        try {
          const body = (await req.json()) as { username?: string };
          if (!body?.username) {
            return Response.json({ message: 'Missing username parameter' }, { status: 400 });
          }
          await refreshUserToken(body.username);
          return Response.json({ status: 'refreshed', username: body.username });
        } catch (error) {
          console.error('Failed to refresh user token:', error);
          return Response.json(
            { message: error instanceof Error ? error.message : String(error) },
            { status: 500 },
          );
        }
      },
    },
    '/auth/login': {
      GET: (req) => {
        const url = new URL(req.url);
        const username = url.searchParams.get('username');

        if (!username) {
          return Response.redirect('/?error=No+username+specified', 302);
        }

        const redirectUri = getRedirectUri(req);
        console.log(
          `[OAuth] Initiating authorization for user "${username}" with redirect_uri: "${redirectUri}"`,
        );
        try {
          const { url: authUrl } = getSimklAuthUrl(username, redirectUri);
          return Response.redirect(authUrl, 302);
        } catch (err) {
          return Response.redirect(
            `/?error=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`,
            302,
          );
        }
      },
    },
    '/auth/callback': {
      GET: async (req) => {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const iss = url.searchParams.get('iss');
        const error = url.searchParams.get('error');

        if (error) {
          return Response.redirect(`/?error=${encodeURIComponent(error)}`, 302);
        }

        if (iss && iss !== 'https://simkl.com') {
          return Response.redirect('/?error=Authorization+response+did+not+come+from+Simkl', 302);
        }

        if (!code || !state) {
          return Response.redirect('/?error=Missing+authorization+code+or+state', 302);
        }

        const session = consumeOAuthSession(state);
        if (!session) {
          return Response.redirect(
            '/?error=Invalid+or+expired+authorization+session.+Please+try+again.',
            302,
          );
        }

        const { username, verifier, redirectUri } = session;

        try {
          const result = await exchangeCodeForToken(code, redirectUri, verifier);
          const expiresInSeconds = result.expiresIn ?? 7 * 24 * 60 * 60; // 7 days default
          const expiresAt = Date.now() + expiresInSeconds * 1000;

          await saveUserToken(username, {
            token: result.accessToken,
            refresh_token: result.refreshToken,
            expires_at: expiresAt,
          });
          console.log(`Successfully authenticated and saved Simkl token for user "${username}"`);
          return Response.redirect(`/?success=${encodeURIComponent(username)}`, 302);
        } catch (err) {
          console.error(`Error exchanging Simkl code for user "${username}":`, err);
          return Response.redirect(
            `/?error=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`,
            302,
          );
        }
      },
    },
    '/webhook': {
      POST: async (req) => {
        const payload = (await req.json()) as RawJellyfinPayload;
        handleWebhook(payload).catch((error) => {
          console.error('Failed executing background webhook handler:', error);
        });
        return Response.json({ status: 'processed' });
      },
    },
    '/mappings/refresh': {
      POST: async () => {
        console.log('Manual mapping refresh triggered via /mappings/refresh');
        try {
          await defaultAnimeResolver.initialize({ forceRefresh: true });
          return Response.json({ status: 'refreshed' });
        } catch (error) {
          console.error('Error during manual mapping refresh:', error);
          return Response.json({ status: 'error', message: String(error) }, { status: 500 });
        }
      },
    },
  },
});

console.log(`Server running at ${server.port}`);

const handleShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Flushing pending scrobbles before exiting...`);
  try {
    await flushAllQueues();
  } catch (err) {
    console.error('Error flushing queues during shutdown:', err);
  }
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
