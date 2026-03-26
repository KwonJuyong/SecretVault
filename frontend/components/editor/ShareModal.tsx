'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { X, UserPlus, Trash2, Globe, Eye, Edit3 } from 'lucide-react';

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
  onClose: () => void;
}

export default function ShareModal({ workspaceId, pageId, pageTitle, onClose }: ShareModalProps) {
  const [shares, setShares] = useState<PageShareItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!email.trim()) return;
    setError('');
    setSuccess('');
    try {
      await api.post(`/workspaces/${workspaceId}/pages/${pageId}/shares`, {
        email: email.trim(),
        permission,
      });
      setSuccess(`Shared with ${email}`);
      setEmail('');
      fetchShares();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to share');
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
    if (!confirm(`Remove ${memberEmail}'s access?`)) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/pages/${pageId}/shares/${shareId}`);
      fetchShares();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white flex items-center gap-2">
              <Globe size={18} /> Share Page
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-[280px]">{pageTitle || 'Untitled'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
            <X size={18} />
          </button>
        </div>

        {/* Invite */}
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter email to share"
              className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
              onKeyDown={e => e.key === 'Enter' && handleShare()}
            />
            <select
              value={permission}
              onChange={e => setPermission(e.target.value)}
              className="px-2 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-800 dark:text-white outline-none"
            >
              <option value="view">View</option>
              <option value="edit">Edit</option>
            </select>
            <button
              onClick={handleShare}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition flex items-center gap-1.5"
            >
              <UserPlus size={15} /> Share
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          {success && <p className="text-xs text-emerald-500 mt-2">{success}</p>}
        </div>

        {/* Shared with */}
        <div className="px-5 py-4">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Shared with ({shares.length})
          </h3>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {loading ? (
              <p className="text-sm text-neutral-400 py-4 text-center">Loading...</p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-neutral-400 py-4 text-center">Not shared with anyone yet</p>
            ) : (
              shares.map(share => (
                <div
                  key={share.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(share.display_name || share.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {share.display_name || share.email}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate">{share.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={share.permission}
                      onChange={e => handleUpdatePermission(share.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 outline-none"
                    >
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                    </select>
                    <button
                      onClick={() => handleRemoveShare(share.id, share.email)}
                      className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 size={14} />
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
