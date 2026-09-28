import { defaultAnimeResolver } from './anime';
import type { RawJellyfinPayload } from './jellyfin';
import { handleWebhook } from './main';

// Override console methods to prepend local timestamps
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const formatLog = (args: any[]) => {
  const timestamp = new Date().toLocaleString();
  return [`[${timestamp}]`, ...args];
};

console.log = (...args) => originalLog(...formatLog(args));
console.warn = (...args) => originalWarn(...formatLog(args));
console.error = (...args) => originalError(...formatLog(args));

// Initialize anime mapping resolver on startup
defaultAnimeResolver.initialize().catch((error) => {
  console.error('Failed to initialize anime resolver on startup:', error);
});

// Automatically check and refresh expired mapping caches every 24 hours
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  console.log('Running scheduled daily check for anime mapping updates...');
  defaultAnimeResolver.initialize().catch((error) => {
    console.error('Failed to refresh anime mappings in background:', error);
  });
}, TWENTY_FOUR_HOURS_MS);

const server = Bun.serve({
  port: 3000,
  routes: {
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
