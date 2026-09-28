import { resolve } from 'path';

export type Config = {
  jellyfin?: { url: string; token: string };
  simkl: {
    app_name: string;
    client_id: string;
    users: Record<string, string>;
  };
  ntfy?: { url: string; token: string; topic: string };
};

let appConfig: Config;
const localConfigPath = resolve('./config.toml'); // local file for dev
const deployedConfigPath = '/config/config.toml'; // config file when deployed to container under /config

const localConfig = Bun.file(localConfigPath);
const deployedConfig = Bun.file(deployedConfigPath);

function validateConfig(config: any): asserts config is Config {
  if (!config || typeof config !== 'object') {
    throw new Error('Config is not a valid object.');
  }

  if (config.jellyfin) {
    if (!config.jellyfin.url || !config.jellyfin.token) {
      throw new Error('Optional "jellyfin" block is present but missing "url" or "token".');
    }
  }

  if (!config.simkl?.app_name || !config.simkl?.client_id || !config.simkl?.users) {
    throw new Error('Missing required "simkl" fields (app_name, client_id, or users map).');
  }

  if (config.ntfy) {
    if (!config.ntfy.url || !config.ntfy.token || !config.ntfy.topic) {
      throw new Error(
        'Optional "ntfy" block is present but missing required sub-properties (url, token, topic).',
      );
    }
  }
}

try {
  let targetPath: string | null = null;

  if (await localConfig.exists()) {
    targetPath = localConfigPath;
  } else if (await deployedConfig.exists()) {
    targetPath = deployedConfigPath;
  }

  if (!targetPath) {
    throw new Error('No config.toml file exists.');
  }
  const { default: config } = await import(targetPath);
  validateConfig(config);
  appConfig = config;
} catch (error) {
  console.error('❌ Configuration Error:');
  if (error instanceof Error) {
    console.error(`${error.message}`);
  } else {
    console.error('Could not find, read, or parse "config.toml" at runtime.');
  }
  process.exit(1);
}

export { appConfig };
