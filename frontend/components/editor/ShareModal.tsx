'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { unwrapPageKey, wrapPageKey, importPublicKey } from '@/lib/crypto';
import { X, UserPlus, Trash2, Share2, Users } from 'lucide-react';
import type { PageTreeItem } from '@/lib/types';

/** Collect all descendant page IDs (BFS). */
function findDescendants(pages: PageTreeItem[], parentId: string): string[] {
  const result: string[] = [];
  const queue = [parentId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const p of pages) {
      if (p.parent_id === cur) {
        result.push(p.id);
        queue.push(p.id);
      }
    }
  }
  return result;
}

interface PageShareItem {
  id: number;
  page_id: string;
  email: string;
  display_name: string | null;
  permission: string;
  shared_by_email: string | null;
  created_at: string | null;
}

interface ShareModalProps {
  workspaceId: string;
  pageId: string;
  pageTitle: string;
  allPages?: PageTreeItem[];
  getDecryptedPageKey?: (pageId: string) => Promise<CryptoKey | null>;
  onClose: () => void;
}

export default function ShareModal({ workspaceId, pageId, pageTitle, allPages, getDecryptedPageKey, onClose }: ShareModalProps) {
  const { privateKey } = useAuth();
  const { t } = useLanguage();
  const [shares, setShares] = useState<PageShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('view');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchShares = async () => {
    try {
      const data = await api.get<PageShareItem[]>(
        `/workspaces/${workspaceId}/pages/${pageId}/shares`
      );
      setShares(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShares(); }, []);

  const handleShare = async () => {
    if (!email.trim() || sharing) return;
    setError('');
    setSuccess('');
    setSharing(true);
    try {
      const sharePayload: Record<string, any> = { email: email.trim(), permission };
      let recipientPubKey: CryptoKey | null = null;

      // Wrap page key for recipient
      try {
        const pubKeyRes = await api.get<{ public_key: string }>(`/users/${encodeURIComponent(email.trim())}/public-key`);
        if (pubKeyRes.public_key && privateKey) {
          recipientPubKey = await importPublicKey(pubKeyRes.public_key);
          const pageData = await api.get<{ page_key_grant: string | null }>(`/workspaces/${workspaceId}/pages/${pageId}`);
          if (pageData.page_key_grant) {
            const pageKey = await unwrapPageKey(pageData.page_key_grant, privateKey);
            sharePayload.encrypted_page_key = await wrapPageKey(pageKey, recipientPubKey);
          }
        }
      } catch { /* key wrapping failed — share without key grant */ }

      // Share root page
      await api.post(`/workspaces/${workspaceId}/pages/${pageId}/shares`, sharePayload);

      // Grant key access to all descendant pages so the recipient can decrypt them too
      if (recipientPubKey && getDecryptedPageKey && allPages) {
        const descendants = findDescendants(allPages, pageId);
        await Promise.allSettled(descendants.map(async (descId) => {
          const descKey = await getDecryptedPageKey(descId);
          if (!descKey) return;
          const wrappedKey = await wrapPageKey(descKey, recipientPubKey!);
          await api.post(`/workspaces/${workspaceId}/pages/${descId}/key-grant`, {
            email: email.trim(),
            encrypted_page_key: wrappedKey,
          });
        }));
      }

      setSuccess(t.sharedWithEmail.replace('{email}', email));
      setEmail('');
      fetchShares();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.failedToShare);
    } finally {
      setSharing(false);
    }
  };

  const handleUpdatePermission = async (shareId: number, newPermission: string) => {
    try {
      await api.put(`/workspaces/${workspaceId}/pages/${pageId}/shares/${shareId}`, {
        permission: newPermission,
      });
      fetchShares();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveShare = async (shareId: number, memberEmail: string) => {
    if (!confirm(t.removeAccess.replace('{email}', memberEmail))) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/pages/${pageId}/shares/${shareId}`);
      fetchShares();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] animate-fade-in"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md mx-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Share2 size={14} className="text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14.5px] font-semibold text-[var(--fg-primary)]">{t.sharePage}</h2>
              <p className="text-[12px] text-[var(--fg-tertiary)] truncate max-w-[280px]">
                {pageTitle || t.untitled}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Invite */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t.enterEmailToShare}
              className="flex-1 min-w-0 px-3 h-9 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px] text-[var(--fg-primary)] outline-none transition-shadow focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] placeholder-[var(--fg-quaternary)]"
              onKeyDown={e => e.key === 'Enter' && handleShare()}
            />
            <select
              value={permission}
              onChange={e => setPermission(e.target.value)}
              className="px-2 h-9 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px] text-[var(--fg-primary)] outline-none cursor-pointer focus:border-[var(--accent)]"
            >
              <option value="view">{t.view}</option>
              <option value="edit">{t.edit}</option>
            </select>
            <button
              onClick={handleShare}
              disabled={sharing || !email.trim()}
              className="px-3.5 h-9 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[13px] font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-[var(--shadow-sm)]"
            >
              <UserPlus size={14} /> {sharing ? '...' : t.share}
            </button>
          </div>
          {error && <p className="text-[12px] text-red-500 mt-2">{error}</p>}
          {success && <p className="text-[12px] text-emerald-600 dark:text-emerald-400 mt-2">{success}</p>}
        </div>

        {/* Shared with */}
        <div className="px-5 py-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider mb-2">
            <Users size={11} /> {t.sharedWith} ({shares.length})
          </h3>
          <div className="max-h-56 overflow-y-auto -mx-1">
            {loading ? (
              <p className="text-[13px] text-[var(--fg-tertiary)] py-6 text-center">{t.loading}</p>
            ) : shares.length === 0 ? (
              <p className="text-[13px] text-[var(--fg-tertiary)] py-6 text-center">{t.notSharedYet}</p>
            ) : (
              shares.map(share => (
                <div
                  key={share.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-hover)] group transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {(share.display_name || share.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--fg-primary)] truncate">
                      {share.display_name || share.email}
                    </p>
                    <p className="text-[11px] text-[var(--fg-tertiary)] truncate">{share.email}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select
                      value={share.permission}
                      onChange={e => handleUpdatePermission(share.id, e.target.value)}
                      className="text-[11.5px] px-1.5 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] outline-none cursor-pointer hover:border-[var(--border-strong)]"
                    >
                      <option value="view">{t.view}</option>
                      <option value="edit">{t.edit}</option>
                    </select>
                    <button
                      onClick={() => handleRemoveShare(share.id, share.email)}
                      className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/15 text-[var(--fg-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
