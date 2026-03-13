'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { deriveKeys } from '@/lib/crypto';
import type { LoginResponse } from '@/lib/types';

interface AuthState {
  isAuthenticated: boolean;
  userId: string;
  displayName: string;
  workspaceId: string;
  encKey: string;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (userId: string, password: string) => Promise<void>;
  signup: (userId: string, password: string, displayName?: string) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    userId: '',
    displayName: '',
    workspaceId: '',
    encKey: '',
    isLoading: true,
  });

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    const userId = sessionStorage.getItem('user_id');
    const displayName = sessionStorage.getItem('display_name');
    const workspaceId = sessionStorage.getItem('workspace_id');
    const encKey = sessionStorage.getItem('enc_key');

    if (token && userId && encKey && workspaceId) {
      setState({
        isAuthenticated: true,
        userId,
        displayName: displayName || userId,
        workspaceId,
        encKey,
        isLoading: false,
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (userId: string, password: string) => {
    const { authHash, encKey } = deriveKeys(password);
    const data = await api.post<LoginResponse>('/login', {
      user_id: userId,
      password_hash: authHash,
    });

    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('user_id', data.user_id);
    sessionStorage.setItem('display_name', data.display_name || data.user_id);
    sessionStorage.setItem('workspace_id', data.workspace_id);
    sessionStorage.setItem('enc_key', encKey);

    setState({
      isAuthenticated: true,
      userId: data.user_id,
      displayName: data.display_name || data.user_id,
      workspaceId: data.workspace_id,
      encKey,
      isLoading: false,
    });
  };

  const signup = async (userId: string, password: string, displayName?: string): Promise<string> => {
    const { authHash } = deriveKeys(password);
    const data = await api.post<{ message: string }>('/signup', {
      user_id: userId,
      password_hash: authHash,
      display_name: displayName,
    });
    return data.message;
  };

  const logout = () => {
    sessionStorage.clear();
    setState({
      isAuthenticated: false,
      userId: '',
      displayName: '',
      workspaceId: '',
      encKey: '',
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
