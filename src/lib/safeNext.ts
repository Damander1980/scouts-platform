// Where to go after sign-in: only a path on this site. Browsers read "/\evil.com" like "//evil.com",
// so anything that isn't a plain same-site path falls back to the default.
export function safeNext(raw: string | null | undefined, fallback: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u001f\\]/.test(raw)) return fallback;
  return raw;
}
