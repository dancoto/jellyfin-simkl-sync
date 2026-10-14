import { describe, expect, it } from 'bun:test';
import {
  getAniListAuthUrl,
  getSimklAuthUrl,
  isCustomUser,
  resolveDefaultUser,
  resolveTargetUsername,
} from './auth.store.utils';

describe('AuthStore Utils', () => {
  describe('isCustomUser', () => {
    it('returns true when user is __custom__', () => {
      expect(isCustomUser('__custom__')).toBe(true);
    });

    it('returns false for regular users', () => {
      expect(isCustomUser('daniel')).toBe(false);
      expect(isCustomUser('')).toBe(false);
    });
  });

  describe('resolveTargetUsername', () => {
    it('returns trimmed custom username when custom user is selected', () => {
      expect(resolveTargetUsername('__custom__', '  customUser123  ')).toBe('customUser123');
    });

    it('returns selected user directly when not custom user', () => {
      expect(resolveTargetUsername('alice', 'bob')).toBe('alice');
    });
  });

  describe('resolveDefaultUser', () => {
    it('returns first Jellyfin user if none is currently selected', () => {
      const jellyfinUsers = [{ id: '1', name: 'JellyfinAdmin' }, { id: '2', name: 'User2' }];
      expect(resolveDefaultUser('', jellyfinUsers)).toBe('JellyfinAdmin');
    });

    it('preserves currently selected user if already set', () => {
      const jellyfinUsers = [{ id: '1', name: 'JellyfinAdmin' }];
      expect(resolveDefaultUser('alice', jellyfinUsers)).toBe('alice');
    });

    it('returns empty string if no Jellyfin users available and none selected', () => {
      expect(resolveDefaultUser('', [])).toBe('');
      expect(resolveDefaultUser('', undefined)).toBe('');
    });
  });

  describe('URL Generators', () => {
    it('generates correct Simkl login URL with URI encoding', () => {
      expect(getSimklAuthUrl('daniel+test')).toBe('/auth/login?username=daniel%2Btest');
    });

    it('generates correct AniList login URL with URI encoding', () => {
      expect(getAniListAuthUrl('user name')).toBe('/auth/anilist/login?username=user%20name');
    });
  });
});
