/**
 * Pure utility functions for AuthStore and authentication state resolution.
 */

export function isCustomUser(selectedUser: string): boolean {
  return selectedUser === '__custom__';
}

export function resolveTargetUsername(selectedUser: string, customUsername: string): string {
  return isCustomUser(selectedUser) ? customUsername.trim() : selectedUser;
}

export function resolveDefaultUser(
  currentSelected: string,
  jellyfinUsers?: { id?: string; name: string }[]
): string {
  if (!currentSelected && jellyfinUsers?.length) {
    return jellyfinUsers[0].name;
  }
  return currentSelected;
}

export function getSimklAuthUrl(username: string): string {
  return `/auth/login?username=${encodeURIComponent(username)}`;
}

export function getAniListAuthUrl(username: string): string {
  return `/auth/anilist/login?username=${encodeURIComponent(username)}`;
}
