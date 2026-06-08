import { handleWebhook } from './main';
import type { WebhookPayload } from './shared/payload';

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

const server = Bun.serve({
  port: 3000,
  routes: {
    '/webhook': {
      POST: async (req) => {
        const payload = (await req.json()) as WebhookPayload;
        handleWebhook(payload).catch((error) => {
          console.error('Failed executing background webhook handler:', error);
        });
        return Response.json({ status: 'processed' });
      },
    },
  },
});

console.log(`Server running at ${server.port}`);
