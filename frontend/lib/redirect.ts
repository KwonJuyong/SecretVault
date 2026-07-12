/**
 * Sanitise a `?next=` redirect target.
 *
 * Only same-origin paths are allowed. Without this check an attacker could send someone a
 * link like `/login?next=https://evil.example/login` and have our own login page bounce
 * them onto a convincing fake — an open redirect.
 *
 * `//evil.example` and `https:/evil` are rejected too: a browser reads a leading `//` as a
 * protocol-relative URL, so "starts with a slash" is not sufficient on its own.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/app'): string {
  if (!next) return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//')) return fallback;
  if (next.includes('\\')) return fallback; // some browsers normalise \ to /
  return next;
}
