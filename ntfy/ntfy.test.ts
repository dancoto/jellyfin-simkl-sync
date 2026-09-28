import { test, expect, mock, describe, beforeEach, afterEach } from 'bun:test';
import { appConfig } from '../shared/config';
import { sendNotification } from './ntfy';

describe('Ntfy Notification Service', () => {
  let fetchMock: any;
  let originalConfig: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.simkl = {
      app_name: 'mock-simkl-app',
      client_id: 'mock-simkl-client-id',
      users: { 'test-user': 'mock-simkl-user-token' },
    };
    appConfig.ntfy = {
      url: 'http://ntfy-mock',
      token: 'mock-ntfy-token',
      topic: 'mock-ntfy-topic',
    };

    fetchMock = mock(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
    mock.restore();
  });

  test('should send notification with merged topic if config is present', async () => {
    sendNotification({
      title: 'Test Title',
      message: 'Test Message',
      priority: 3,
    });

    // Yield execution for fetch promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).toHaveBeenCalled();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ntfy-mock');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      title: 'Test Title',
      message: 'Test Message',
      priority: 3,
      topic: 'mock-ntfy-topic',
    });
  });

  test('should skip fetch if ntfy config is not present', async () => {
    appConfig.ntfy = undefined;

    sendNotification({
      title: 'Test Title',
      message: 'Test Message',
      priority: 3,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
