'use client';

import { createContext, useContext, useCallback, useSyncExternalStore, ReactNode } from 'react';
import { en, ko } from '@/lib/i18n';
import type { Translations } from '@/lib/i18n';

export type Language = 'en' | 'ko';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const translations: Record<Language, Translations> = { en, ko };
const STORAGE_KEY = 'sv_lang';

const LanguageContext = createContext<LanguageContextType | null>(null);

/**
 * The chosen language lives in localStorage, which React cannot read while rendering on
 * the server. Reading it in an effect and calling setState would work, but it paints one
 * frame in English before correcting itself — a visible flash for every Korean user.
 *
 * useSyncExternalStore is the primitive for exactly this: React subscribes to the external
 * value, renders `en` on the server, and reconciles to the stored language on hydration
 * without an extra render pass of its own.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Also follow changes made in another tab.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'ko' || saved === 'en' ? saved : 'en';
}

function getServerSnapshot(): Language {
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = useCallback((next: Language) => {
    localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach(notify => notify());
  }, []);

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
