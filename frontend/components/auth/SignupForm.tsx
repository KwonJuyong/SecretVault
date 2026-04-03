'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, UserPlus, ArrowLeft, Eye, EyeOff, Globe } from 'lucide-react';

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

  const inputClass = "w-full h-[52px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-[15px] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 transition-colors duration-200";

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
            {t.startCollaborating}
          </h2>
          <p className="text-violet-200/60 text-[15px] leading-relaxed max-w-[360px]">
            {t.startCollaboratingDesc}
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

          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">{t.createAccount}</h1>
          <p className="text-base text-neutral-500 dark:text-neutral-400 mb-10">{t.setupWorkspace}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[15px] font-medium text-neutral-700 dark:text-neutral-300 mb-2.5">
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
              <label className="block text-[15px] font-medium text-neutral-700 dark:text-neutral-300 mb-2.5">
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
              <label className="block text-[15px] font-medium text-neutral-700 dark:text-neutral-300 mb-2.5">
                {t.password} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                  placeholder={t.createPassword}
                  autoComplete="new-password"
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

            <div>
              <label className="block text-[15px] font-medium text-neutral-700 dark:text-neutral-300 mb-2.5">
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
              className="w-full h-[52px] flex items-center justify-center gap-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-[15px] font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus size={18} />
                  {t.createAccount}
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-[15px] text-neutral-500 dark:text-neutral-400">
            {t.haveAccount}{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-violet-500 hover:text-violet-600 dark:text-violet-400 font-semibold inline-flex items-center gap-1"
            >
              <ArrowLeft size={15} />
              {t.signIn}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
