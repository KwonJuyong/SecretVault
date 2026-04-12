'use client';

import { useState, useEffect } from 'react';
import { X, User, Save, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { UserProfile } from '@/lib/types';

interface ProfileModalProps { onClose: () => void; }

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { email: userEmail } = useAuth();
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<UserProfile>('/me').then(data => {
      setDisplayName(data.display_name || '');
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      await api.put('/me', { display_name: displayName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const initial = (displayName || userEmail || '?').trim().charAt(0).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] animate-fade-in"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm mx-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
              <User size={15} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-[14.5px] font-semibold text-[var(--fg-primary)]">{t.profile}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-6 space-y-5">
          <div className="flex items-center gap-3 pb-5 border-b border-[var(--border-subtle)]">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[17px] font-bold flex-shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-[var(--fg-primary)] truncate">
                {displayName || userEmail}
              </div>
              <div className="text-[12px] text-[var(--fg-tertiary)] truncate">{userEmail}</div>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-[var(--fg-secondary)] mb-2">
              {t.email}
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="w-full px-4 h-11 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--fg-tertiary)] text-[13.5px] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-[var(--fg-secondary)] mb-2">
              {t.displayName}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={t.yourDisplayName}
              className="w-full px-4 h-11 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-primary)] text-[13.5px] outline-none transition-shadow focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] placeholder-[var(--fg-quaternary)]"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13.5px] font-semibold transition-colors disabled:opacity-50 shadow-[var(--shadow-sm)]"
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? t.saving : saved ? t.savedExclaim : t.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
}
