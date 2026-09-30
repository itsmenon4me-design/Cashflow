const OAUTH_AVATAR_URL =
  /^https:\/\/(?:[a-z0-9-]+\.)*(?:googleusercontent|githubusercontent)\.com(?:[/:?#]|$)/i;

export function isOAuthAvatarUrl(value: string): boolean {
  return OAUTH_AVATAR_URL.test(value);
}
