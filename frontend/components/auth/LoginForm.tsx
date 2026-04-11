'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookLock, ArrowRight, Eye, EyeOff, Globe, Lock } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  const [redirecting, setRedirecting] = useState(false);

  const toggleLang = () => setLang(lang === 'en' ? 'ko' : 'en');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError(t.enterEmailAndPassword);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      setRedirecting(true);
      router.push('/app');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.loginFailed;
      setError(message === 'Unauthorized' ? t.invalidCredentials : message);
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-app)] gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3a3442] to-[#1e1a26] flex items-center justify-center text-[#e8e2d4] shadow-[var(--shadow-lg)] ring-1 ring-black/5">
          <BookLock size={26} strokeWidth={1.75} />
        </div>
        <div className="w-6 h-6 border-2 border-[var(--accent)]/25 border-t-[var(--accent)] rounded-full animate-spin" />
        <p className="text-[13px] text-[var(--fg-tertiary)]">{t.loadingWorkspace}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg-app)]">
      {/* Left - Branding hero */}
      <div
        className="hidden lg:flex lg:w-[460px] auth-hero relative flex-col justify-between text-white overflow-hidden"
        style={{ paddingLeft: '58px', paddingRight: '56px', paddingTop: '50px', paddingBottom: '48px' }}
      >
        <div className="absolute inset-0 auth-grid pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3a3442] to-[#1e1a26] flex items-center justify-center text-[#e8e2d4] shadow-lg shadow-black/30 ring-1 ring-white/10">
              <BookLock size={21} strokeWidth={1.75} />
            </div>
            <span className="text-[22px] font-semibold tracking-tight">SecretVault</span>
          </div>
        </div>
        <div className="relative pr-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-8 rounded-full bg-white/5 border border-white/10 backdrop-blur text-[11.5px] font-medium text-white/70">
            <Lock size={11} /> End-to-end encrypted
          </div>
          <h2 className="text-[36px] font-semibold leading-[1.15] mb-7 whitespace-pre-line tracking-tight text-white/95">
            {t.secureWorkspace}
          </h2>
          <p className="text-white/55 text-[15px] leading-[1.75] max-w-[340px]">
            {t.secureWorkspaceDesc}
          </p>
        </div>
        <div className="relative text-[11.5px] text-white/30">
          &copy; {new Date().getFullYear()} SecretVault · {t.allRightsReserved}
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center relative px-8 sm:px-20 py-16">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] text-[12.5px] font-semibold transition-colors"
          title={t.language}
        >
          <Globe size={14} />
          <span>{lang === 'en' ? 'EN' : 'KO'}</span>
        </button>

        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3a3442] to-[#1e1a26] flex items-center justify-center text-[#e8e2d4] shadow-lg ring-1 ring-black/5">
              <BookLock size={21} strokeWidth={1.75} />
            </div>
            <span className="text-[22px] font-semibold text-[var(--fg-primary)] tracking-tight">SecretVault</span>
          </div>

          <h1 className="text-[28px] font-bold text-[var(--fg-primary)] tracking-tight mb-1.5">{t.welcomeBack}</h1>
          <p className="text-[14.5px] text-[var(--fg-secondary)] mb-9">{t.signInToWorkspace}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-3.5 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-[13px] animate-slide-up">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-[var(--fg-primary)] mb-2">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-primary)] text-[14px] placeholder-[var(--fg-tertiary)] outline-none focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] transition-shadow"
                placeholder={t.enterEmail}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[var(--fg-primary)] mb-2">{t.password}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-11 px-3.5 pr-10 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-primary)] text-[14px] placeholder-[var(--fg-tertiary)] outline-none focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] transition-shadow"
                  placeholder={t.enterPassword}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[14px] font-semibold transition-colors shadow-[var(--shadow-sm)] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {t.signIn}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-9 text-center text-[13.5px] text-[var(--fg-secondary)]">
            {t.noAccount}{' '}
            <button
              onClick={() => router.push('/signup')}
              className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-semibold transition-colors"
            >
              {t.createOne}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
