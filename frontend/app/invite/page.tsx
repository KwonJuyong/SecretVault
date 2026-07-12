'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  parseInviteFragment, deriveInviteKeys, unwrapWorkspaceKeyFromInvite,
} from '@/lib/invite';
import { wrapWorkspaceKeyForUser } from '@/lib/crypto';
import { Lock, Users, AlertCircle, Loader2 } from 'lucide-react';

interface InvitePreview {
  id: string;
  workspace_id: string;
  workspace_name: string;
  role: string;
  email: string | null;
  invited_by_email: string | null;
}

type Status = 'loading' | 'ready' | 'accepting' | 'error';

/**
 * Landing page for an invite link.
 *
 * The link's secret is in the fragment (`#id.secret`), which the browser never sends to
 * the server — so the secret exists only here, in this tab. It is used to unwrap the
 * workspace key, which is then immediately re-wrapped under this user's own RSA key and
 * sent back as their permanent grant. After that the link is spent.
 */
export default function InvitePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthenticated, isLoading, publicKey, email, switchWorkspace } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [fragment, setFragment] = useState<{ inviteId: string; secret: string } | null>(null);

  // The fragment can only be read on the client — it never reaches the server, which is
  // the entire point of putting the secret there. Parsed inside the async effect so the
  // page renders its loading shell identically on server and client.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const parsed = parseInviteFragment(window.location.hash);
      if (!parsed) {
        if (!cancelled) { setError(t.inviteLinkInvalid); setStatus('error'); }
        return;
      }

      try {
        const { authToken } = await deriveInviteKeys(parsed.secret);
        const preview = await api.get<InvitePreview>(
          `/invites/${parsed.inviteId}?auth_token=${encodeURIComponent(authToken)}`,
        );
        if (cancelled) return;
        setFragment(parsed);
        setInvite(preview);
        setStatus('ready');
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '';
        setError(/410/.test(msg) ? t.inviteLinkExpired : t.inviteLinkInvalid);
        setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [t.inviteLinkExpired, t.inviteLinkInvalid]);

  const accept = useCallback(async () => {
    if (!fragment || !invite || !publicKey) return;
    setStatus('accepting');
    setError('');

    try {
      const { authToken, wrapKey } = await deriveInviteKeys(fragment.secret);

      // Fetch the wrapped key again rather than holding it in state: it is the one value
      // here that grants access, and the round trip is cheap.
      const preview = await api.get<InvitePreview & { encrypted_workspace_key: string }>(
        `/invites/${fragment.inviteId}?auth_token=${encodeURIComponent(authToken)}`,
      );

      const workspaceKey = await unwrapWorkspaceKeyFromInvite(
        preview.encrypted_workspace_key, wrapKey,
      );
      const grantForMe = await wrapWorkspaceKeyForUser(workspaceKey, publicKey);

      await api.post(`/invites/${fragment.inviteId}/accept`, {
        auth_token: authToken,
        encrypted_workspace_key: grantForMe,
      });

      switchWorkspace(invite.workspace_id);
      router.push('/app');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.failedToInvite);
      setStatus('ready');
    }
  }, [fragment, invite, publicKey, switchWorkspace, router, t.failedToInvite]);

  if (isLoading || status === 'loading') {
    return (
      <Shell>
        <Loader2 className="w-6 h-6 animate-spin text-[var(--fg-tertiary)]" />
      </Shell>
    );
  }

  if (status === 'error') {
    return (
      <Shell>
        <AlertCircle className="w-9 h-9 text-red-500 mb-3" />
        <h1 className="text-lg font-semibold mb-1.5">{t.inviteLinkInvalid}</h1>
        <p className="text-[13px] text-[var(--fg-tertiary)] leading-relaxed">{error}</p>
      </Shell>
    );
  }

  // The invite is real, but there is nobody to grant it to yet.
  if (!isAuthenticated) {
    return (
      <Shell>
        <Users className="w-9 h-9 text-[var(--accent)] mb-3" />
        <h1 className="text-lg font-semibold mb-1.5">
          {t.inviteJoinTitle.replace('{workspace}', invite?.workspace_name ?? '')}
        </h1>
        <p className="text-[13px] text-[var(--fg-tertiary)] leading-relaxed mb-5">
          {invite?.invited_by_email
            ? t.inviteInvitedBy.replace('{email}', invite.invited_by_email)
            : ''}
        </p>
        <p className="text-[12.5px] text-[var(--fg-tertiary)] mb-4">{t.inviteSignInFirst}</p>
        <div className="flex gap-2">
          {/* The fragment rides along, so the link still works after they come back. */}
          <button
            onClick={() => router.push(`/signup?next=${encodeURIComponent('/invite' + window.location.hash)}`)}
            className="px-4 h-10 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13.5px] font-semibold transition-colors"
          >
            {t.createAccount}
          </button>
          <button
            onClick={() => router.push(`/login?next=${encodeURIComponent('/invite' + window.location.hash)}`)}
            className="px-4 h-10 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-hover)] text-[13.5px] font-medium transition-colors"
          >
            {t.signIn}
          </button>
        </div>
      </Shell>
    );
  }

  const wrongAccount = invite?.email && invite.email !== email.toLowerCase();

  return (
    <Shell>
      <Users className="w-9 h-9 text-[var(--accent)] mb-3" />
      <h1 className="text-lg font-semibold mb-1.5">
        {t.inviteJoinTitle.replace('{workspace}', invite?.workspace_name ?? '')}
      </h1>
      {invite?.invited_by_email && (
        <p className="text-[13px] text-[var(--fg-tertiary)] mb-4">
          {t.inviteInvitedBy.replace('{email}', invite.invited_by_email)}
        </p>
      )}

      {wrongAccount ? (
        <p className="text-[13px] text-red-500 leading-relaxed">
          {t.inviteWrongAccount.replace('{email}', invite!.email!)}
        </p>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-[12px] text-[var(--fg-tertiary)] mb-5">
            <Lock size={12} /> {t.inviteKeyNotice}
          </p>
          <button
            onClick={accept}
            disabled={status === 'accepting' || !publicKey}
            className="px-5 h-10 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[13.5px] font-semibold transition-colors flex items-center gap-2"
          >
            {status === 'accepting' && <Loader2 size={14} className="animate-spin" />}
            {t.inviteAccept}
          </button>
          {error && <p className="text-[12px] text-red-500 mt-3">{error}</p>}
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] text-[var(--fg-primary)] p-6">
      <div className="w-full max-w-md flex flex-col items-center text-center p-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]">
        {children}
      </div>
    </div>
  );
}
