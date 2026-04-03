'use client';

import { useState, useEffect } from 'react';
import { X, User, Save } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="text-lg font-bold text-neutral-900">{t.profile}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">{t.email}</label>
            <input type="email" value={userEmail} disabled className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">{t.displayName}</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder={t.yourDisplayName} />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition disabled:opacity-50">
            <Save size={14} /> {saving ? t.saving : saved ? t.savedExclaim : t.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
}
