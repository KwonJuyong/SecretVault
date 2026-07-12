'use client';

import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  // LoginForm reads ?next= via useSearchParams, which cannot be resolved while the page is
  // being prerendered — Next needs a Suspense boundary to fall back to at build time.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)]" />}>
      <LoginForm />
    </Suspense>
  );
}
