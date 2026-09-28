import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { appConfig } from './config';
import { getLogLevel, logger, originalConsole, shouldLog } from './logger';

describe('Shared Logger Module', () => {
  let originalConfig: any;
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;
  let debugSpy: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    logSpy = mock(() => {});
    warnSpy = mock(() => {});
    errorSpy = mock(() => {});
    debugSpy = mock(() => {});

    originalConsole.log = logSpy;
    originalConsole.info = logSpy;
    originalConsole.warn = warnSpy;
    originalConsole.error = errorSpy;
    originalConsole.debug = debugSpy;
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
  });

  test('getLogLevel should default to "info" when logging is undefined', () => {
    delete appConfig.logging;
    expect(getLogLevel()).toBe('info');
    expect(shouldLog('debug')).toBe(false);
    expect(shouldLog('info')).toBe(true);
    expect(shouldLog('warn')).toBe(true);
    expect(shouldLog('error')).toBe(true);
  });

  test('shouldLog should respect debug level', () => {
    appConfig.logging = { level: 'debug' };
    expect(getLogLevel()).toBe('debug');
    expect(shouldLog('debug')).toBe(true);
    expect(shouldLog('info')).toBe(true);
    expect(shouldLog('warn')).toBe(true);
    expect(shouldLog('error')).toBe(true);

    logger.debug('debug message');
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0][0]).toContain('[DEBUG]');
    expect(debugSpy.mock.calls[0][1]).toBe('debug message');
  });

  test('shouldLog should suppress debug when level is info', () => {
    appConfig.logging = { level: 'info' };
    logger.debug('hidden debug');
    expect(debugSpy).toHaveBeenCalledTimes(0);

    logger.info('visible info');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('[INFO]');
    expect(logSpy.mock.calls[0][1]).toBe('visible info');
  });

  test('shouldLog should suppress info when level is warn', () => {
    appConfig.logging = { level: 'warn' };
    logger.debug('hidden debug');
    logger.info('hidden info');
    expect(debugSpy).toHaveBeenCalledTimes(0);
    expect(logSpy).toHaveBeenCalledTimes(0);

    logger.warn('warning message');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[WARN]');

    logger.error('error message');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('[ERROR]');
  });
});
