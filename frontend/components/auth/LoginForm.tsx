'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, ArrowRight, Eye, EyeOff, Globe } from 'lucide-react';

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-950 gap-4">
        <div className="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center text-white">
          <Shield size={24} />
        </div>
        <div className="w-6 h-6 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
        <p className="text-sm text-neutral-400">{t.loadingWorkspace}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex p-4 sm:p-6 lg:p-0 bg-neutral-100 dark:bg-neutral-900 lg:bg-white lg:dark:bg-neutral-950">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-[520px] bg-gradient-to-br from-[#1c1826] via-[#241e33] to-[#1c1826] flex-col justify-between text-white px-16 py-14">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center">
              <Shield size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight">SecretVault</span>
          </div>
        </div>
        <div className="pr-8">
          <h2 className="text-[34px] font-bold leading-tight mb-5 whitespace-pre-line">
            {t.secureWorkspace}
          </h2>
          <p className="text-violet-200/60 text-[15px] leading-relaxed max-w-[360px]">
            {t.secureWorkspaceDesc}
          </p>
        </div>
        <div className="text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} SecretVault. {t.allRightsReserved}
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-neutral-950 px-8 sm:px-16 relative">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 text-[13px] font-medium transition-colors duration-200"
          title={t.language}
        >
          <Globe size={15} />
          <span>{lang === 'en' ? 'EN' : 'KO'}</span>
        </button>

        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center text-white">
              <Shield size={24} />
            </div>
            <span className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">SecretVault</span>
          </div>

          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">{t.welcomeBack}</h1>
          <p className="text-base text-neutral-500 dark:text-neutral-400 mb-10">{t.signInToWorkspace}</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[15px] font-medium text-neutral-700 dark:text-neutral-300 mb-2.5">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-[52px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-[15px] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 transition-colors duration-200"
                placeholder={t.enterEmail}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[15px] font-medium text-neutral-700 dark:text-neutral-300 mb-2.5">{t.password}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-[52px] px-4 pr-11 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-[15px] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 transition-colors duration-200"
                  placeholder={t.enterPassword}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] flex items-center justify-center gap-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-[15px] font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {t.signIn}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-[15px] text-neutral-500 dark:text-neutral-400">
            {t.noAccount}{' '}
            <button
              onClick={() => router.push('/signup')}
              className="text-violet-500 hover:text-violet-600 dark:text-violet-400 font-semibold"
            >
              {t.createOne}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
