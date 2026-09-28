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
  },
});

console.log(`Server running at ${server.port}`);
