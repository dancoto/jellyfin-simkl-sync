import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AniBridgeIndex } from './anibridge';

export const OVERRIDES_FILE_NAME = 'anidb-mapping-overrides.json';

export const getOverridesFilePath = (customPath?: string): string => {
  if (customPath) {
    return resolve(customPath);
  }
  const inConfig = resolve('/config', OVERRIDES_FILE_NAME);
  if (existsSync(inConfig)) {
    return inConfig;
  }
  return resolve('.', OVERRIDES_FILE_NAME);
};

export const loadOverrides = (customPath?: string): AniBridgeIndex | null => {
  const filePath = getOverridesFilePath(customPath);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    console.log(`Loaded manual anime overrides from ${filePath}`);
    return AniBridgeIndex.parse(parsed);
  } catch (error) {
    console.error(`Failed to load mapping overrides from ${filePath}:`, error);
    return null;
  }
};
