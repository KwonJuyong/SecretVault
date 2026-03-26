'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import {
  legacyDeriveKeys,
  derivePasswordKey, generateSalt, generateKeyPair,
  exportPublicKey, encryptPrivateKey, decryptPrivateKey,
  exportPrivateKeyJwk, importPrivateKeyJwk, importPublicKey,
} from '@/lib/crypto';
import type { LoginResponse } from '@/lib/types';

interface AuthState {
  isAuthenticated: boolean;
  email: string;
  displayName: string;
  workspaceId: string;
  encKey: string;           // legacy v1 key
  privateKey: CryptoKey | null;
  publicKey: CryptoKey | null;
  hasKeyPair: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username?: string) => Promise<string>;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => void;
  ensureKeyPair: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    email: '',
    displayName: '',
    workspaceId: '',
    encKey: '',
    privateKey: null,
    publicKey: null,
    hasKeyPair: false,
    isLoading: true,
  });

  useEffect(() => {
    const restore = async () => {
      const token = sessionStorage.getItem('access_token');
      const email = sessionStorage.getItem('email');
      const displayName = sessionStorage.getItem('display_name');
      const workspaceId = sessionStorage.getItem('workspace_id');
      const encKey = sessionStorage.getItem('enc_key');
      const privateKeyJwk = sessionStorage.getItem('private_key_jwk');
      const publicKeyB64 = sessionStorage.getItem('public_key');

      if (token && email && encKey && workspaceId) {
        let privateKey: CryptoKey | null = null;
        let publicKey: CryptoKey | null = null;
        let hasKeyPair = false;

        if (privateKeyJwk && publicKeyB64) {
          try {
            privateKey = await importPrivateKeyJwk(privateKeyJwk);
            publicKey = await importPublicKey(publicKeyB64);
            hasKeyPair = true;
          } catch {
            // Key restore failed, will need re-login
          }
        }

        setState({
          isAuthenticated: true,
          email,
          displayName: displayName || email,
          workspaceId,
          encKey,
          privateKey,
          publicKey,
          hasKeyPair,
          isLoading: false,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    restore();
  }, []);

  const login = async (email: string, password: string) => {
    const { authHash, encKey } = legacyDeriveKeys(password);
    const data = await api.post<LoginResponse>('/login', {
      email,
      password_hash: authHash,
    });

    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('email', data.email);
    sessionStorage.setItem('display_name', data.display_name || data.email);
    sessionStorage.setItem('workspace_id', data.workspace_id);
    sessionStorage.setItem('enc_key', encKey);

    let privateKey: CryptoKey | null = null;
    let publicKey: CryptoKey | null = null;
    let hasKeyPair = false;

    if (data.encrypted_private_key && data.private_key_iv && data.private_key_salt && data.public_key) {
      try {
        const salt = Uint8Array.from(atob(data.private_key_salt), c => c.charCodeAt(0));
        const passwordKey = await derivePasswordKey(password, salt);
        privateKey = await decryptPrivateKey(data.encrypted_private_key, data.private_key_iv, passwordKey);
        publicKey = await importPublicKey(data.public_key);
        hasKeyPair = true;

        // Store in session for refresh restoration
        const jwk = await exportPrivateKeyJwk(privateKey);
        sessionStorage.setItem('private_key_jwk', jwk);
        sessionStorage.setItem('public_key', data.public_key);
      } catch (e) {
        console.error('Failed to decrypt key pair:', e);
      }
    }

    setState({
      isAuthenticated: true,
      email: data.email,
      displayName: data.display_name || data.email,
      workspaceId: data.workspace_id,
      encKey,
      privateKey,
      publicKey,
      hasKeyPair,
      isLoading: false,
    });
  };

  const signup = async (email: string, password: string, username?: string): Promise<string> => {
    const { authHash } = legacyDeriveKeys(password);

    // Generate RSA key pair
    const keyPair = await generateKeyPair();
    const pubKeyB64 = await exportPublicKey(keyPair.publicKey);
    const salt = generateSalt();
    const passwordKey = await derivePasswordKey(password, salt);
    const { encrypted, iv } = await encryptPrivateKey(keyPair.privateKey, passwordKey);
    const saltB64 = btoa(String.fromCharCode(...salt));

    const data = await api.post<{ message: string }>('/signup', {
      email,
      password_hash: authHash,
      username,
      public_key: pubKeyB64,
      encrypted_private_key: encrypted,
      private_key_iv: iv,
      private_key_salt: saltB64,
    });
    return data.message;
  };

  const ensureKeyPair = async (password: string) => {
    if (state.hasKeyPair) return;

    const keyPair = await generateKeyPair();
    const pubKeyB64 = await exportPublicKey(keyPair.publicKey);
    const salt = generateSalt();
    const passwordKey = await derivePasswordKey(password, salt);
    const { encrypted, iv } = await encryptPrivateKey(keyPair.privateKey, passwordKey);
    const saltB64 = btoa(String.fromCharCode(...salt));

    await api.post('/me/keypair', {
      public_key: pubKeyB64,
      encrypted_private_key: encrypted,
      private_key_iv: iv,
      private_key_salt: saltB64,
    });

    const jwk = await exportPrivateKeyJwk(keyPair.privateKey);
    sessionStorage.setItem('private_key_jwk', jwk);
    sessionStorage.setItem('public_key', pubKeyB64);

    setState(prev => ({
      ...prev,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      hasKeyPair: true,
    }));
  };

  const logout = () => {
    sessionStorage.clear();
    setState({
      isAuthenticated: false,
      email: '',
      displayName: '',
      workspaceId: '',
      encKey: '',
      privateKey: null,
      publicKey: null,
      hasKeyPair: false,
      isLoading: false,
    });
  };

  const switchWorkspace = (workspaceId: string) => {
    sessionStorage.setItem('workspace_id', workspaceId);
    setState(prev => ({ ...prev, workspaceId }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, switchWorkspace, ensureKeyPair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
