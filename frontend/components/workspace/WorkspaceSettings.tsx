'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Workspace, WorkspaceMember } from '@/lib/types';
import {
  X, UserPlus, Shield, ShieldCheck, Crown, UserMinus, Users,
} from 'lucide-react';

interface WorkspaceSettingsProps {
  workspace: Workspace;
  onClose: () => void;
  onUpdated: () => void;
}

export default function WorkspaceSettings({ workspace, onClose, onUpdated }: WorkspaceSettingsProps) {
  const { email: currentEmail } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

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

  const handleInvite = async () => {
    if (!inviteUserId.trim()) return;
    setInviteError('');
    setInviteSuccess('');
    try {
      await api.post(`/workspaces/${workspace.id}/members`, {
        user_id: inviteUserId.trim(),
        role: inviteRole,
      });
      setInviteSuccess(`${inviteUserId} has been invited!`);
      setInviteUserId('');
      fetchMembers();
      onUpdated();
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : 'Failed to invite member');
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!confirm(`Remove ${memberUserId} from this workspace?`)) return;
    try {
      await api.post(`/workspaces/${workspace.id}/members/remove`, {
        user_id: memberUserId,
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
        user_id: memberUserId,
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
      case 'owner': return <Crown size={14} className="text-amber-500" />;
      case 'admin': return <ShieldCheck size={14} className="text-blue-500" />;
      default: return <Shield size={14} className="text-neutral-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{workspace.icon || '\u{1F4BC}'}</span>
            <div>
              <h2 className="text-base font-semibold text-neutral-800 dark:text-white">{workspace.name}</h2>
              <p className="text-xs text-neutral-400">Workspace Settings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
            <X size={18} />
          </button>
        </div>

        {/* Invite Section */}
        {isAdmin && (
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
              <UserPlus size={16} /> Invite Member
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteUserId}
                onChange={e => setInviteUserId(e.target.value)}
                placeholder="Email"
                className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-800 dark:text-white outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleInvite}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
              >
                Invite
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-500 mt-2">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-emerald-500 mt-2">{inviteSuccess}</p>}
          </div>
        )}

        {/* Members List */}
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
            <Users size={16} /> Members ({members.length})
          </h3>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {loading ? (
              <p className="text-sm text-neutral-400 py-4 text-center">Loading...</p>
            ) : (
              members.map(member => (
                <div
                  key={member.email}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(member.display_name || member.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {member.display_name || member.email}
                      {member.email === currentEmail && (
                        <span className="ml-1.5 text-[10px] text-neutral-400 font-normal">(you)</span>
                      )}
                    </p>
                    <p className="text-[11px] text-neutral-400">@{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {roleIcon(member.role)}
                    {isOwner && member.role !== 'owner' && member.email !== currentEmail ? (
                      <>
                        <select
                          value={member.role}
                          onChange={e => handleUpdateRole(member.email, e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 opacity-0 group-hover:opacity-100 transition outline-none"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.email)}
                          className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                          title="Remove member"
                        >
                          <UserMinus size={14} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-neutral-400 capitalize px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-700/50">
                        {member.role}
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
