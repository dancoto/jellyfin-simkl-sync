import { defaultAnimeResolver } from './anime';
import { renderAuthHtml } from './auth/page';
import {
  handleGetOverrides,
  handleImportOverrides,
  handleOverridesPage,
  handleRetireRedundantOverrides,
  handleSaveOverrides,
  handleSyncCatalog,
  handleSyncSeries,
} from './overrides/api';
import { defaultJellyfinClient, type RawJellyfinPayload } from './jellyfin';
import { handleWebhook } from './main';
import { appConfig, saveAniListUserToken, saveUserToken } from './shared/config';
import {
  consumeAniListOAuthSession,
  exchangeCodeForAniListToken,
  getAniListAuthUrl,
  validateAniListUserToken,
} from './anilist/auth';
import {
  consumeOAuthSession,
  exchangeCodeForToken,
  getSimklAuthUrl,
  refreshUserToken,
  validateUserToken,
} from './simkl/auth';
import { flushAllAniListQueues } from './anilist/scrobbler';
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

const getAniListRedirectUri = (req: Request): string => {
  if (appConfig.anilist?.redirect_uri) {
    return appConfig.anilist.redirect_uri;
  }
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const proto =
    req.headers.get('x-forwarded-proto') || (url.protocol.startsWith('https') ? 'https' : 'http');
  return `${proto}://${host}/auth/anilist/callback`;
};

const handleAuthPage = (req: Request) => {
  const url = new URL(req.url);
  const simklRedirectUri = getRedirectUri(req);
  const anilistRedirectUri = getAniListRedirectUri(req);
  const successUser = url.searchParams.get('success') ?? undefined;
  const successService = url.searchParams.get('service') ?? undefined;
  const errorMessage = url.searchParams.get('error') ?? undefined;

  const html = renderAuthHtml({
    clientId: appConfig.simkl.client_id,
    hasClientSecret: Boolean(appConfig.simkl.client_secret),
    redirectUri: simklRedirectUri,
    simkl: {
      clientId: appConfig.simkl.client_id,
      hasClientSecret: Boolean(appConfig.simkl.client_secret),
      redirectUri: simklRedirectUri,
    },
    anilist: {
      clientId: appConfig.anilist?.client_id,
      hasClientSecret: Boolean(appConfig.anilist?.client_secret),
      redirectUri: anilistRedirectUri,
    },
    successUser,
    successService,
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
    '/overrides': {
      GET: handleOverridesPage,
    },
    '/api/overrides': {
      GET: handleGetOverrides,
      POST: handleSaveOverrides,
    },
    '/api/overrides/import': {
      POST: handleImportOverrides,
    },
    '/api/catalog/sync': {
      POST: handleSyncCatalog,
    },
    '/api/catalog/sync-series': {
      POST: handleSyncSeries,
    },
    '/api/series/sync': {
      POST: handleSyncSeries,
    },
    '/api/overrides/retire-redundant': {
      POST: (req) => handleRetireRedundantOverrides(req),
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
        for (const u of Object.keys(appConfig.anilist?.users || {})) {
          allUsernames.add(u);
        }

        const userStatuses = await Promise.all(
          Array.from(allUsernames).map(async (username) => {
            // Check Simkl status
            let simklEntry = appConfig.simkl.users[username];
            let simklStatus = {
              isConfigured: false,
              isValid: false,
              simklUsername: undefined as string | undefined,
              expiresInDays: undefined as number | undefined,
              hasRefreshToken: false,
              error: undefined as string | undefined,
            };

            if (simklEntry) {
              const ONE_DAY_MS = 24 * 60 * 60 * 1000;
              if (
                typeof simklEntry === 'object' &&
                simklEntry?.refresh_token &&
                simklEntry?.expires_at
              ) {
                if (Date.now() + ONE_DAY_MS >= simklEntry.expires_at) {
                  try {
                    await refreshUserToken(username);
                    simklEntry = appConfig.simkl.users[username];
                  } catch (e) {
                    console.error(`Auto-refresh during status check failed for "${username}":`, e);
                  }
                }
              }

              const check = await validateUserToken(simklEntry);
              let expiresInDays: number | undefined;
              const hasRefreshToken =
                typeof simklEntry === 'object' && Boolean(simklEntry?.refresh_token);

              if (typeof simklEntry === 'object' && simklEntry?.expires_at) {
                const diffMs = simklEntry.expires_at - Date.now();
                expiresInDays = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
              }

              simklStatus = {
                isConfigured: true,
                isValid: check.valid,
                simklUsername: check.simklUsername,
                expiresInDays,
                hasRefreshToken,
                error: check.error,
              };
            }

            // Check AniList status
            const anilistEntry = appConfig.anilist?.users?.[username];
            let anilistStatus = {
              isConfigured: false,
              isValid: false,
              anilistUsername: undefined as string | undefined,
              anilistUserId: undefined as number | undefined,
              expiresInDays: undefined as number | undefined,
              error: undefined as string | undefined,
            };

            if (anilistEntry) {
              const check = await validateAniListUserToken(anilistEntry);
              let expiresInDays: number | undefined;
              if (typeof anilistEntry === 'object' && anilistEntry?.expires_at) {
                const diffMs = anilistEntry.expires_at - Date.now();
                expiresInDays = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
              }

              anilistStatus = {
                isConfigured: true,
                isValid: check.valid,
                anilistUsername: check.anilistUsername,
                anilistUserId: check.anilistUserId,
                expiresInDays,
                error: check.error,
              };
            }

            return {
              username,
              simkl: simklStatus,
              anilist: anilistStatus,
              // Top-level backwards compatibility
              isConfigured: simklStatus.isConfigured,
              isValid: simklStatus.isValid,
              simklUsername: simklStatus.simklUsername,
              expiresInDays: simklStatus.expiresInDays,
              hasRefreshToken: simklStatus.hasRefreshToken,
              error: simklStatus.error,
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
    '/auth/anilist/login': {
      GET: (req) => {
        const url = new URL(req.url);
        const username = url.searchParams.get('username');

        if (!username) {
          return Response.redirect('/?error=No+username+specified', 302);
        }

        const redirectUri = getAniListRedirectUri(req);
        console.log(
          `[OAuth] Initiating AniList authorization for user "${username}" with redirect_uri: "${redirectUri}"`,
        );
        try {
          const { url: authUrl } = getAniListAuthUrl(username, redirectUri);
          return Response.redirect(authUrl, 302);
        } catch (err) {
          return Response.redirect(
            `/?error=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`,
            302,
          );
        }
      },
    },
    '/auth/anilist/callback': {
      GET: async (req) => {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDesc = url.searchParams.get('error_description');

        if (error) {
          return Response.redirect(`/?error=${encodeURIComponent(errorDesc || error)}`, 302);
        }

        if (!code || !state) {
          return Response.redirect('/?error=Missing+authorization+code+or+state', 302);
        }

        const session = consumeAniListOAuthSession(state);
        if (!session) {
          return Response.redirect(
            '/?error=Invalid+or+expired+authorization+session.+Please+try+again.',
            302,
          );
        }

        const { username, redirectUri } = session;

        try {
          const result = await exchangeCodeForAniListToken(code, redirectUri);
          const expiresInSeconds = result.expiresIn ?? 31536000; // 1 year default
          const expiresAt = Date.now() + expiresInSeconds * 1000;

          await saveAniListUserToken(username, {
            token: result.accessToken,
            expires_at: expiresAt,
          });
          console.log(`Successfully authenticated and saved AniList token for user "${username}"`);
          return Response.redirect(
            `/?success=${encodeURIComponent(username)}&service=anilist`,
            302,
          );
        } catch (err) {
          console.error(`Error exchanging AniList code for user "${username}":`, err);
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
    await flushAllAniListQueues();
  } catch (err) {
    console.error('Error flushing queues during shutdown:', err);
  }
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
