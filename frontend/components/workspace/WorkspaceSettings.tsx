'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { importPublicKey, wrapWorkspaceKeyForUser } from '@/lib/crypto';
import {
  createInviteSecret, deriveInviteKeys, wrapWorkspaceKeyForInvite, buildInviteLink,
} from '@/lib/invite';
import { sha256Hex } from '@/lib/hash';
import type { Workspace, WorkspaceMember } from '@/lib/types';
import {
  X, UserPlus, Shield, ShieldCheck, Crown, UserMinus, Users, Link2, Copy, Check,
} from 'lucide-react';

interface WorkspaceSettingsProps {
  workspace: Workspace;
  onClose: () => void;
  onUpdated: () => void;
}

export default function WorkspaceSettings({ workspace, onClose, onUpdated }: WorkspaceSettingsProps) {
  const { email: currentEmail, workspaceKey } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  // Shown when the invitee has no account and we minted a link instead. Held only in
  // memory: the secret in it is the one thing that must not be persisted anywhere.
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const isOwner = workspace.role === 'owner';
  const isAdmin = workspace.role === 'admin' || isOwner;

  const fetchMembers = async () => {
    try {
      const data = await api.get<WorkspaceMember[]>(`/workspaces/${workspace.id}/members`);
      setMembers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  /**
   * Mint an invite link for someone who has no account yet.
   *
   * We cannot wrap the workspace key for a public key that does not exist, so it is
   * wrapped under a key derived from a random secret that lives only in the link's URL
   * fragment — which browsers never send to a server. The server stores the wrapped key
   * and a hash of a *separate* token derived from the same secret, so it can check that a
   * caller holds the link without being able to open what it is holding.
   */
  const createInviteLink = async (email: string) => {
    if (!workspaceKey) throw new Error(t.inviteNeedsWorkspaceKey);

    const secret = createInviteSecret();
    const { authToken, wrapKey } = await deriveInviteKeys(secret);

    const { id } = await api.post<{ id: string }>(`/workspaces/${workspace.id}/invites`, {
      auth_token_hash: await sha256Hex(authToken),
      encrypted_workspace_key: await wrapWorkspaceKeyForInvite(workspaceKey, wrapKey),
      role: inviteRole,
      email: email || null,
      expires_in_days: 7,
    });

    return buildInviteLink(window.location.origin, id, secret);
  };

  const handleInvite = async () => {
    const email = inviteUserId.trim();
    if (!email) return;
    setInviteError('');
    setInviteSuccess('');
    setInviteLink('');

    if (!workspaceKey) {
      setInviteError(t.inviteNeedsWorkspaceKey);
      return;
    }

    try {
      // The server cannot do this: it never holds the workspace key in the clear. So the
      // inviter's browser re-wraps that one key to the invitee's public key. That single
      // grant is what gives them every page in the workspace, now and later.
      const { public_key } = await api.get<{ public_key: string }>(
        `/users/${encodeURIComponent(email)}/public-key`,
      );
      const inviteePublicKey = await importPublicKey(public_key);
      const wrappedForInvitee = await wrapWorkspaceKeyForUser(workspaceKey, inviteePublicKey);

      await api.post(`/workspaces/${workspace.id}/members`, {
        email,
        role: inviteRole,
        encrypted_workspace_key: wrappedForInvitee,
      });
      setInviteSuccess(t.invitedSuccess.replace('{email}', email));
      setInviteUserId('');
      fetchMembers();
      onUpdated();
    } catch (e: unknown) {
      // No account, so no public key to wrap for. Fall back to a link they can sign up
      // through, rather than making the inviter care about the difference.
      const notRegistered = e instanceof Error && /404|not found|no encryption keys/i.test(e.message);
      if (notRegistered) {
        try {
          setInviteLink(await createInviteLink(email));
          setInviteUserId('');
          return;
        } catch (linkErr: unknown) {
          setInviteError(linkErr instanceof Error ? linkErr.message : t.failedToInvite);
          return;
        }
      }
      setInviteError(e instanceof Error ? e.message : t.failedToInvite);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!confirm(t.removeFromWorkspace.replace('{email}', memberUserId))) return;
    try {
      await api.post(`/workspaces/${workspace.id}/members/remove`, {
        email: memberUserId,
      });
      fetchMembers();
      onUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRole = async (memberUserId: string, newRole: string) => {
    try {
      await api.put(`/workspaces/${workspace.id}/members/role`, {
        email: memberUserId,
        role: newRole,
      });
      fetchMembers();
      onUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown size={13} className="text-amber-500" />;
      case 'admin': return <ShieldCheck size={13} className="text-[var(--accent)]" />;
      default: return <Shield size={13} className="text-[var(--fg-tertiary)]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] animate-fade-in"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-2)] flex items-center justify-center text-[20px] flex-shrink-0">
              {workspace.icon || '\u{1F4BC}'}
            </div>
            <div className="min-w-0">
              <h2 className="text-[14.5px] font-semibold text-[var(--fg-primary)] truncate">{workspace.name}</h2>
              <p className="text-[12px] text-[var(--fg-tertiary)]">{t.workspaceSettingsTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Invite Section */}
        {isAdmin && (
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <h3 className="text-[11px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <UserPlus size={12} /> {t.inviteMember}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteUserId}
                onChange={e => setInviteUserId(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="flex-1 min-w-0 px-4 h-11 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13.5px] text-[var(--fg-primary)] outline-none transition-shadow focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] placeholder-[var(--fg-quaternary)]"
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="px-2.5 h-11 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13.5px] text-[var(--fg-primary)] outline-none cursor-pointer focus:border-[var(--accent)]"
              >
                <option value="member">{t.member}</option>
                <option value="admin">{t.admin}</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={!inviteUserId.trim()}
                className="px-4 h-11 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[13.5px] font-semibold transition-colors flex-shrink-0 shadow-[var(--shadow-sm)]"
              >
                {t.invite}
              </button>
            </div>
            {inviteError && <p className="text-[12px] text-red-500 mt-2">{inviteError}</p>}
            {inviteSuccess && <p className="text-[12px] text-emerald-600 dark:text-emerald-400 mt-2">{inviteSuccess}</p>}

            {inviteLink && (
              <div className="mt-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-2)]">
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--fg-primary)] mb-1">
                  <Link2 size={13} /> {t.inviteLinkCreated}
                </p>
                <p className="text-[11.5px] text-[var(--fg-tertiary)] leading-relaxed mb-2">
                  {t.inviteLinkNotice}
                </p>
                <div className="flex gap-1.5">
                  <input
                    readOnly
                    value={inviteLink}
                    onFocus={e => e.currentTarget.select()}
                    className="flex-1 min-w-0 px-2.5 h-9 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[11.5px] font-mono text-[var(--fg-secondary)] outline-none"
                  />
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteLink);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    className="px-3 h-9 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-hover)] text-[var(--fg-secondary)] transition-colors flex items-center gap-1 flex-shrink-0"
                    title={t.copyLink}
                  >
                    {linkCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Members List */}
        <div className="px-5 py-4">
          <h3 className="text-[11px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Users size={12} /> {t.members} ({members.length})
          </h3>
          <div className="max-h-64 overflow-y-auto -mx-1">
            {loading ? (
              <p className="text-[13px] text-[var(--fg-tertiary)] py-6 text-center">{t.loading}</p>
            ) : (
              members.map(member => (
                <div
                  key={member.email}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-hover)] group transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {(member.display_name || member.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--fg-primary)] truncate">
                      {member.display_name || member.email}
                      {member.email === currentEmail && (
                        <span className="ml-1.5 text-[10px] text-[var(--fg-tertiary)] font-normal">{t.you}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[var(--fg-tertiary)] truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {roleIcon(member.role)}
                    {isOwner && member.role !== 'owner' && member.email !== currentEmail ? (
                      <>
                        <select
                          value={member.role}
                          onChange={e => handleUpdateRole(member.email, e.target.value)}
                          className="text-[11.5px] px-1.5 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] outline-none opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          <option value="member">{t.member}</option>
                          <option value="admin">{t.admin}</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.email)}
                          className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/15 text-[var(--fg-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                          title={t.removeMember}
                        >
                          <UserMinus size={13} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10.5px] font-medium text-[var(--fg-tertiary)] px-2 py-0.5 rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)]">
                        {member.role === 'owner' ? t.owner : member.role === 'admin' ? t.admin : t.member}
                      </span>
                    )}
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
