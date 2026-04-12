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

export async function decrypt(data: string, pageKey: CryptoKey): Promise<string> {
  if (!data) return '';
  try {
    const combined = new Uint8Array(b64Decode(data));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, pageKey, ciphertext);
    return new TextDecoder().decode(plainBuf);
  } catch {
    return '';
  }
}
