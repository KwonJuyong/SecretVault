'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookLock, UserPlus, ArrowLeft, Eye, EyeOff, Globe, Lock } from 'lucide-react';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  const toggleLang = () => setLang(lang === 'en' ? 'ko' : 'en');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !username.trim() || !password.trim()) {
      setError(t.fillAllFields);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.passwordsNoMatch);
      return;
    }
    if (password.length < 4) {
      setError(t.passwordTooShort);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signup(email, password, username);
      router.push('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.signupFailed);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full h-11 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-primary)] text-[14px] placeholder-[var(--fg-tertiary)] outline-none focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] transition-shadow';

  return (
    <div className="min-h-screen flex bg-[var(--bg-app)]">
      {/* Left - Branding hero */}
      <div
        className="hidden lg:flex lg:w-[460px] auth-hero relative flex-col justify-between text-white overflow-hidden"
        style={{ paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px' }}
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
            {t.startCollaborating}
          </h2>
          <p className="text-white/55 text-[15px] leading-[1.75] max-w-[340px]">
            {t.startCollaboratingDesc}
          </p>
        </div>
        <div className="relative text-[11.5px] text-white/30">
          &copy; {new Date().getFullYear()} SecretVault · {t.allRightsReserved}
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center relative px-8 sm:px-20 py-16">
        <button
          onClick={toggleLang}
          className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] text-[12.5px] font-semibold transition-colors"
          title={t.language}
        >
          <Globe size={14} />
          <span>{lang === 'en' ? 'EN' : 'KO'}</span>
        </button>

        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3a3442] to-[#1e1a26] flex items-center justify-center text-[#e8e2d4] shadow-lg ring-1 ring-black/5">
              <BookLock size={21} strokeWidth={1.75} />
            </div>
            <span className="text-[22px] font-semibold text-[var(--fg-primary)] tracking-tight">SecretVault</span>
          </div>

          <h1 className="text-[28px] font-bold text-[var(--fg-primary)] tracking-tight mb-1.5">{t.createAccount}</h1>
          <p className="text-[14.5px] text-[var(--fg-secondary)] mb-8">{t.setupWorkspace}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-3.5 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-[13px] animate-slide-up">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-[var(--fg-primary)] mb-2">
                {t.email} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                placeholder={t.enterEmail}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[var(--fg-primary)] mb-2">
                {t.username} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={inputClass}
                placeholder={t.chooseDisplayName}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[var(--fg-primary)] mb-2">
                {t.password} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder={t.createPassword}
                  autoComplete="new-password"
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

            <div>
              <label className="block text-[13px] font-semibold text-[var(--fg-primary)] mb-2">
                {t.confirmPassword} <span className="text-red-500">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder={t.confirmYourPassword}
                autoComplete="new-password"
              />
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
                  <UserPlus size={16} />
                  {t.createAccount}
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[13.5px] text-[var(--fg-secondary)]">
            {t.haveAccount}{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={13} />
              {t.signIn}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
