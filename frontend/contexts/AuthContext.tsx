'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { deriveKeys } from '@/lib/crypto';
import type { LoginResponse } from '@/lib/types';

interface AuthState {
  isAuthenticated: boolean;
  email: string;
  displayName: string;
  workspaceId: string;
  encKey: string;
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
    encKey: '',
    isLoading: true,
  });

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    const email = sessionStorage.getItem('email');
    const displayName = sessionStorage.getItem('display_name');
    const workspaceId = sessionStorage.getItem('workspace_id');
    const encKey = sessionStorage.getItem('enc_key');

    if (token && email && encKey && workspaceId) {
      setState({
        isAuthenticated: true,
        email,
        displayName: displayName || email,
        workspaceId,
        encKey,
        isLoading: false,
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { authHash, encKey } = deriveKeys(password);
    const data = await api.post<LoginResponse>('/login', {
      email,
      password_hash: authHash,
    });

    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('email', data.email);
    sessionStorage.setItem('display_name', data.display_name || data.email);
    sessionStorage.setItem('workspace_id', data.workspace_id);
    sessionStorage.setItem('enc_key', encKey);

    setState({
      isAuthenticated: true,
      email: data.email,
      displayName: data.display_name || data.email,
      workspaceId: data.workspace_id,
      encKey,
      isLoading: false,
    });
  };

  const signup = async (email: string, password: string, username?: string): Promise<string> => {
    const { authHash } = deriveKeys(password);
    const data = await api.post<{ message: string }>('/signup', {
      email,
      password_hash: authHash,
      username,
    });
    return data.message;
  };

  const logout = () => {
    sessionStorage.clear();
    setState({
      isAuthenticated: false,
      email: '',
      displayName: '',
      workspaceId: '',
      encKey: '',
      isLoading: false,
    });
  };

  const switchWorkspace = (workspaceId: string) => {
    sessionStorage.setItem('workspace_id', workspaceId);
    setState(prev => ({ ...prev, workspaceId }));
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
