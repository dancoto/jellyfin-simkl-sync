import { appConfig } from '../shared/config';
import type { NtfyMessage } from './models';

export const sendNotification = (message: NtfyMessage): void => {
  if (!appConfig.ntfy) {
    console.warn('ntfy configuration is missing; notification skipped.');
    return;
  }
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('Authorization', `Bearer ${appConfig.ntfy.token}`);
  fetch(appConfig.ntfy.url, {
    headers,
    method: 'POST',
    body: JSON.stringify({
      ...message,
      topic: appConfig.ntfy.topic,
    }),
  }).catch((error) => {
    console.error('Failed to send background ntfy notification:', error);
  });
};
