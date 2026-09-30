import { describe, expect, it } from "vitest";
import { isOAuthAvatarUrl } from "./oauth-avatar";

describe("isOAuthAvatarUrl", () => {
  it.each([
    "https://lh3.googleusercontent.com/a/avatar",
    "https://avatars.githubusercontent.com/u/123?v=4",
  ])("accepts provider avatar URL %s", (url) => {
    expect(isOAuthAvatarUrl(url)).toBe(true);
  });

  it.each([
    "https://neraca.public.blob.vercel-storage.com/avatar.png",
    "https://googleusercontent.com.evil.example/avatar.png",
    "http://avatars.githubusercontent.com/u/123",
  ])("rejects non-provider avatar URL %s", (url) => {
    expect(isOAuthAvatarUrl(url)).toBe(false);
  });
});
