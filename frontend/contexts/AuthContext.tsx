'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import {
  deriveKeys,
  derivePasswordKey, generateSalt, generateKeyPair,
  exportPublicKey, encryptPrivateKey, decryptPrivateKey,
  exportPrivateKeyJwk, importPrivateKeyJwk, importPublicKey,
  generateWorkspaceKey, wrapWorkspaceKeyForUser, unwrapWorkspaceKeyForUser,
} from '@/lib/crypto';
import type { LoginResponse, WorkspaceKeyResponse } from '@/lib/types';

interface AuthState {
  isAuthenticated: boolean;
  email: string;
  displayName: string;
  workspaceId: string;
  privateKey: CryptoKey | null;
  publicKey: CryptoKey | null;
  /**
   * The active workspace's key, unwrapped. Every page key in the workspace is wrapped
   * under it, so this is what lets a member read pages they did not create.
   * Null while it is still being fetched, or if this user holds no grant.
   */
  workspaceKey: CryptoKey | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username?: string) => Promise<string>;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    email: '',
    displayName: '',
    workspaceId: '',
    privateKey: null,
    publicKey: null,
    workspaceKey: null,
    isLoading: true,
  });

  useEffect(() => {
    const restore = async () => {
      const token = sessionStorage.getItem('access_token');
      const email = sessionStorage.getItem('email');
      const displayName = sessionStorage.getItem('display_name');
      const workspaceId = sessionStorage.getItem('workspace_id');
      const privateKeyJwk = sessionStorage.getItem('private_key_jwk');
      const publicKeyB64 = sessionStorage.getItem('public_key');

      if (token && email && workspaceId && privateKeyJwk && publicKeyB64) {
        try {
          const privateKey = await importPrivateKeyJwk(privateKeyJwk);
          const publicKey = await importPublicKey(publicKeyB64);
          setState({
            isAuthenticated: true, email,
            displayName: displayName || email,
            workspaceId, privateKey, publicKey,
            workspaceKey: null, // fetched by the effect below
            isLoading: false,
          });
        } catch {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    restore();
  }, []);

  /**
   * Pull down this user's wrapped copy of the active workspace's key and unwrap it.
   * Runs on login and on every workspace switch — each workspace has its own key.
   */
  const loadWorkspaceKey = useCallback(async (workspaceId: string, privateKey: CryptoKey) => {
    try {
      const res = await api.get<WorkspaceKeyResponse>(`/workspaces/${workspaceId}/key`);
      const workspaceKey = await unwrapWorkspaceKeyForUser(res.encrypted_workspace_key, privateKey);
      setState(prev => (prev.workspaceId === workspaceId ? { ...prev, workspaceKey } : prev));
    } catch {
      // 404 means nobody has granted this user the key. Pages will render as locked
      // rather than as deceptively blank documents.
      setState(prev => (prev.workspaceId === workspaceId ? { ...prev, workspaceKey: null } : prev));
    }
  }, []);

  useEffect(() => {
    if (!state.isAuthenticated || !state.workspaceId || !state.privateKey) return;
    if (state.workspaceKey) return;
    loadWorkspaceKey(state.workspaceId, state.privateKey);
  }, [state.isAuthenticated, state.workspaceId, state.privateKey, state.workspaceKey, loadWorkspaceKey]);

  const login = async (email: string, password: string) => {
    const { authHash } = deriveKeys(password);
    const data = await api.post<LoginResponse>('/login', { email, password_hash: authHash });

    if (!data.encrypted_private_key || !data.private_key_iv || !data.private_key_salt || !data.public_key) {
      throw new Error('Account encryption keys not found. Please re-register.');
    }

    const salt = Uint8Array.from(atob(data.private_key_salt), c => c.charCodeAt(0));
    const passwordKey = await derivePasswordKey(password, salt);
    const privateKey = await decryptPrivateKey(data.encrypted_private_key, data.private_key_iv, passwordKey);
    const publicKey = await importPublicKey(data.public_key);

    const jwk = await exportPrivateKeyJwk(privateKey);
    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('email', data.email);
    sessionStorage.setItem('display_name', data.display_name || data.email);
    sessionStorage.setItem('workspace_id', data.workspace_id);
    sessionStorage.setItem('private_key_jwk', jwk);
    sessionStorage.setItem('public_key', data.public_key);

    setState({
      isAuthenticated: true,
      email: data.email,
      displayName: data.display_name || data.email,
      workspaceId: data.workspace_id,
      privateKey, publicKey,
      workspaceKey: null, // the effect above fetches and unwraps it
      isLoading: false,
    });
  };

  const signup = async (email: string, password: string, username?: string): Promise<string> => {
    const { authHash } = deriveKeys(password);
    const keyPair = await generateKeyPair();
    const pubKeyB64 = await exportPublicKey(keyPair.publicKey);
    const salt = generateSalt();
    const passwordKey = await derivePasswordKey(password, salt);
    const { encrypted, iv } = await encryptPrivateKey(keyPair.privateKey, passwordKey);
    const saltB64 = btoa(String.fromCharCode(...salt));

    // Signup also creates the user's first workspace, so its key has to exist by the time
    // the server makes it. Generated here and wrapped to the brand-new public key.
    const workspaceKey = await generateWorkspaceKey();
    const wrappedWorkspaceKey = await wrapWorkspaceKeyForUser(workspaceKey, keyPair.publicKey);

    const data = await api.post<{ message: string }>('/signup', {
      email, password_hash: authHash, username,
      public_key: pubKeyB64,
      encrypted_private_key: encrypted,
      private_key_iv: iv,
      private_key_salt: saltB64,
      encrypted_workspace_key: wrappedWorkspaceKey,
    });
    return data.message;
  };

  const logout = () => {
    sessionStorage.clear();
    setState({
      isAuthenticated: false, email: '', displayName: '',
      workspaceId: '', privateKey: null, publicKey: null,
      workspaceKey: null, isLoading: false,
    });
  };

  const switchWorkspace = (workspaceId: string) => {
    sessionStorage.setItem('workspace_id', workspaceId);
    // Drop the old workspace's key: it cannot open anything in the new one, and the
    // effect above will fetch the right one.
    setState(prev => ({ ...prev, workspaceId, workspaceKey: null }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, switchWorkspace }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
