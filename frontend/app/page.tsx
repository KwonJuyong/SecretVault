'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      router.replace(isAuthenticated ? '/app' : '/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg-app)]">
      <div className="w-7 h-7 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
    </div>
  );
}
