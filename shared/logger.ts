import { appConfig, type LogLevel } from './config';

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Store original console methods so we can call them without recursion
export const originalConsole = {
  log: console.log.bind(console),
  info: (console.info ?? console.log).bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: (console.debug ?? console.log).bind(console),
};

export const getLogLevel = (): LogLevel => {
  const configured = appConfig?.logging?.level?.toLowerCase() as LogLevel | undefined;
  if (configured && configured in LEVEL_SEVERITY) {
    return configured;
  }
  return 'info';
};

export const shouldLog = (level: LogLevel): boolean => {
  const currentLevel = getLogLevel();
  return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[currentLevel];
};

const formatMessage = (level: string, args: any[]): any[] => {
  const timestamp = new Date().toLocaleString();
  return [`[${timestamp}] [${level}]`, ...args];
};

export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog('debug')) {
      originalConsole.debug(...formatMessage('DEBUG', args));
    }
  },
  info: (...args: any[]) => {
    if (shouldLog('info')) {
      originalConsole.info(...formatMessage('INFO', args));
    }
  },
  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      originalConsole.warn(...formatMessage('WARN', args));
    }
  },
  error: (...args: any[]) => {
    if (shouldLog('error')) {
      originalConsole.error(...formatMessage('ERROR', args));
    }
  },
};

/**
 * Initializes global console overrides so existing console.log/warn/error/debug calls
 * adhere to the configured log level and format.
 */
export const initLogger = () => {
  console.debug = (...args: any[]) => logger.debug(...args);
  console.log = (...args: any[]) => logger.info(...args);
  console.info = (...args: any[]) => logger.info(...args);
  console.warn = (...args: any[]) => logger.warn(...args);
  console.error = (...args: any[]) => logger.error(...args);
};
