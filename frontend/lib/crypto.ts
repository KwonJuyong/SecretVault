import CryptoJS from 'crypto-js';

export function deriveKeys(password: string) {
  return {
    authHash: CryptoJS.SHA256(password + 'AUTH_SALT').toString(),
    encKey: CryptoJS.SHA256(password + 'DATA_SALT').toString(),
  };
}

export function encrypt(plaintext: string, key: string): string {
  if (!plaintext) return '';
  return CryptoJS.AES.encrypt(plaintext, key).toString();
}

export function decrypt(ciphertext: string, key: string): string {
  if (!ciphertext) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
}
