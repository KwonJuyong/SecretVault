'use client';

import { Suspense } from 'react';
import SignupForm from '@/components/auth/SignupForm';

export default function SignupPage() {
  // See app/login/page.tsx: SignupForm reads ?next= via useSearchParams, which needs a
  // Suspense boundary to prerender against.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-app)]" />}>
      <SignupForm />
    </Suspense>
  );
}
