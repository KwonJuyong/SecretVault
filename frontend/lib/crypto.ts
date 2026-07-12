// ===========================
// Auth hash (for login/signup)
// ===========================
import CryptoJS from 'crypto-js';

export function deriveKeys(password: string) {
  return {
    authHash: CryptoJS.SHA256(password + 'AUTH_SALT').toString(),
  };
}

// ===========================
// Web Crypto API — E2E Encryption
// ===========================

// Use a chunked approach to avoid call-stack limits on large buffers
function b64Encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function b64Decode(str: string): ArrayBuffer {
  const bin = atob(str);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// --- Password → AES key (for encrypting RSA private key) ---

export async function derivePasswordKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// --- RSA Key Pair ---

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['wrapKey', 'unwrapKey'],
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key);
  return b64Encode(spki);
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', b64Decode(base64), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['wrapKey']);
}

export async function exportPrivateKeyJwk(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPrivateKeyJwk(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr);
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['unwrapKey']);
}

export async function encryptPrivateKey(
  privateKey: CryptoKey,
  passwordKey: CryptoKey,
): Promise<{ encrypted: string; iv: string }> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, passwordKey, pkcs8);
  return { encrypted: b64Encode(ciphertext), iv: b64Encode(iv.buffer) };
}

export async function decryptPrivateKey(
  encryptedBase64: string,
  ivBase64: string,
  passwordKey: CryptoKey,
): Promise<CryptoKey> {
  const ciphertext = b64Decode(encryptedBase64);
  const iv = b64Decode(ivBase64);
  const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, passwordKey, ciphertext);
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['unwrapKey']);
}

// --- Page AES Key ---

export async function generatePageKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function wrapPageKey(pageKey: CryptoKey, publicKey: CryptoKey): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey('raw', pageKey, publicKey, { name: 'RSA-OAEP' });
  return b64Encode(wrapped);
}

export async function unwrapPageKey(wrappedBase64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const wrapped = b64Decode(wrappedBase64);
  return crypto.subtle.unwrapKey(
    'raw', wrapped, privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// --- Workspace Key (AES-KW) ---
//
// Every workspace has one AES-KW key. It is wrapped once per member with that
// member's RSA public key, and it in turn wraps each page key. This is what makes
// an invite O(1): the inviter re-wraps a single workspace key for the newcomer,
// and every page in the workspace — including ones created later — becomes readable.
//
// AES-KW (RFC 3394) rather than AES-GCM because this key only ever wraps other keys;
// AES-KW takes no IV, so there is no IV to get wrong or reuse.

export async function generateWorkspaceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-KW', length: 256 }, true, ['wrapKey', 'unwrapKey']);
}

/** Wrap the workspace key for one member, using their RSA public key. Called when inviting. */
export async function wrapWorkspaceKeyForUser(workspaceKey: CryptoKey, publicKey: CryptoKey): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey('raw', workspaceKey, publicKey, { name: 'RSA-OAEP' });
  return b64Encode(wrapped);
}

/** Recover the workspace key from this member's grant, using their RSA private key. Called on login. */
export async function unwrapWorkspaceKeyForUser(wrappedBase64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw', b64Decode(wrappedBase64), privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-KW', length: 256 },
    true,
    ['wrapKey', 'unwrapKey'],
  );
}

/** Wrap a page key under the workspace key, so every member can open the page. */
export async function wrapPageKeyForWorkspace(pageKey: CryptoKey, workspaceKey: CryptoKey): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey('raw', pageKey, workspaceKey, { name: 'AES-KW' });
  return b64Encode(wrapped);
}

/** Recover a page key from its workspace-wrapped form. */
export async function unwrapPageKeyFromWorkspace(wrappedBase64: string, workspaceKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw', b64Decode(wrappedBase64), workspaceKey,
    { name: 'AES-KW' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// --- Content Encryption (AES-GCM) ---

export async function encrypt(plaintext: string, pageKey: CryptoKey): Promise<string> {
  if (!plaintext) return '';
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, pageKey, enc.encode(plaintext));
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return b64Encode(combined.buffer);
}

/** Thrown when ciphertext cannot be opened with the given key (wrong key, or tampered data). */
export class DecryptError extends Error {
  constructor(cause?: unknown) {
    super('Failed to decrypt content');
    this.name = 'DecryptError';
    this.cause = cause;
  }
}

/**
 * Decrypt page content. Throws DecryptError if the ciphertext will not open.
 *
 * It must throw rather than return '': a caller that cannot tell "this page is empty"
 * from "I could not read this page" will happily re-encrypt the empty string over the
 * user's real content on the next autosave, and E2E means there is no server-side copy
 * to restore from.
 */
export async function decrypt(data: string, pageKey: CryptoKey): Promise<string> {
  if (!data) return '';
  try {
    const combined = new Uint8Array(b64Decode(data));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, pageKey, ciphertext);
    return new TextDecoder().decode(plainBuf);
  } catch (e) {
    throw new DecryptError(e);
  }
}

/**
 * Decrypt, or return null if the content will not open.
 *
 * For read-only surfaces (sidebar titles, outlines) where one unreadable page should
 * degrade to a placeholder instead of taking down the whole list. Never use this on a
 * value that is going to be written back.
 */
export async function decryptOrNull(data: string, pageKey: CryptoKey): Promise<string | null> {
  try {
    return await decrypt(data, pageKey);
  } catch {
    return null;
  }
}
