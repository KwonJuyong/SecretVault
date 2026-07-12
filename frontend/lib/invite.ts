/**
 * Invite links for people who have not signed up yet.
 *
 * The workspace key has to be wrapped for the invitee, but they have no RSA key pair yet —
 * they have no account. So it is wrapped under a key derived from a random secret that
 * lives only in the invite link.
 *
 * The secret sits in the URL *fragment* (`#...`), which browsers never transmit. The
 * server therefore cannot read it from the request line, from logs, or from a Referer
 * header, and cannot unwrap the workspace key it is storing.
 *
 * Two independent values are derived from that one secret via HKDF:
 *
 *   authToken — sent to the server, which stores only its SHA-256. Proves the caller holds
 *               the link, without which anyone who guessed an invite id could join the
 *               workspace as a member holding a garbage key.
 *   wrapKey   — never leaves the browser. Unwraps the workspace key.
 *
 * Deriving both from the same secret with different HKDF `info` labels means the server,
 * holding only a hash of authToken, cannot work back to wrapKey.
 */

const SECRET_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A fresh invite secret. This is the only thing that must stay out of the server's reach. */
export function createInviteSecret(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));
}

async function hkdf(secret: Uint8Array, info: string, bits: number): Promise<ArrayBuffer> {
  const base = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      // No salt: the secret is already 256 bits of CSPRNG output, so there is no weak
      // input entropy for a salt to protect against.
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    base,
    bits,
  );
}

export interface InviteKeys {
  /** Sent to the server as proof the caller has the link. */
  authToken: string;
  /** Stays in the browser. Wraps and unwraps the workspace key. */
  wrapKey: CryptoKey;
}

export async function deriveInviteKeys(secret: string): Promise<InviteKeys> {
  const raw = fromBase64Url(secret);

  const authBits = await hkdf(raw, 'secretvault/invite/auth', 256);
  const wrapBits = await hkdf(raw, 'secretvault/invite/wrap', 256);

  const wrapKey = await crypto.subtle.importKey(
    'raw', wrapBits, { name: 'AES-KW' }, false, ['wrapKey', 'unwrapKey'],
  );

  return { authToken: toBase64Url(new Uint8Array(authBits)), wrapKey };
}

/** Wrap the workspace key so that only a holder of the invite link can open it. */
export async function wrapWorkspaceKeyForInvite(
  workspaceKey: CryptoKey, wrapKey: CryptoKey,
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey('raw', workspaceKey, wrapKey, { name: 'AES-KW' });
  return toBase64Url(new Uint8Array(wrapped));
}

/** Recover the workspace key from an invite, using the secret in the link. */
export async function unwrapWorkspaceKeyFromInvite(
  wrappedBase64Url: string, wrapKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    fromBase64Url(wrappedBase64Url) as BufferSource,
    wrapKey,
    { name: 'AES-KW' },
    { name: 'AES-KW', length: 256 },
    true,
    ['wrapKey', 'unwrapKey'],
  );
}

/** Build the link handed to the invitee. The secret goes after the '#'. */
export function buildInviteLink(origin: string, inviteId: string, secret: string): string {
  return `${origin}/invite#${inviteId}.${secret}`;
}

/** Read an invite link's fragment. Returns null if it is not a well-formed invite. */
export function parseInviteFragment(fragment: string): { inviteId: string; secret: string } | null {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;

  const inviteId = raw.slice(0, dot);
  const secret = raw.slice(dot + 1);
  if (!inviteId || !secret) return null;
  return { inviteId, secret };
}
