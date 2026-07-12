'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  encrypt, decrypt, decryptOrNull,
  generatePageKey, unwrapPageKey,
  wrapPageKeyForWorkspace, unwrapPageKeyFromWorkspace,
} from '@/lib/crypto';
import { usePageDoc } from '@/lib/usePageDoc';
import type { CollabMessage } from '@/lib/collab';
import type { PageTreeItem, PageData, Workspace, TocHeading } from '@/lib/types';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import RightPanel from '@/components/layout/RightPanel';
import Editor from '@/components/editor/Editor';
import SearchModal from '@/components/search/SearchModal';
import TrashPanel from '@/components/layout/TrashPanel';
import WorkspaceSettings from '@/components/workspace/WorkspaceSettings';
import CreateWorkspaceModal from '@/components/workspace/CreateWorkspaceModal';
import TipsModal from '@/components/ui/TipsModal';
import ShareModal from '@/components/editor/ShareModal';
import { htmlToMarkdown, downloadFile, exportPDF } from '@/lib/export';
import PageTreeView from '@/components/dashboard/PageTreeView';
import { FileText, Plus, Lock } from 'lucide-react';

export default function AppPage() {
  const { isAuthenticated, isLoading, workspaceId, privateKey, workspaceKey, switchWorkspace } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [pages, setPages] = useState<PageTreeItem[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [settingsWorkspace, setSettingsWorkspace] = useState<Workspace | null>(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [sharedPagePermission, setSharedPagePermission] = useState<string | null>(null);
  const [subPageTitles, setSubPageTitles] = useState<Record<string, string>>({});
  const [tocHeadings, setTocHeadings] = useState<TocHeading[]>([]);
  // Set when the open page's ciphertext would not decrypt. Saving stays off while true,
  // otherwise we would encrypt a blank editor over content we merely failed to read.
  const [pageLocked, setPageLocked] = useState(false);

  // Collaboration state for the open page.
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [activePageKey, setActivePageKey] = useState<CryptoKey | null>(null);
  const [sealedSnapshot, setSealedSnapshot] = useState('');   // encrypted Yjs doc
  const [legacyHtml, setLegacyHtml] = useState<string | null>(null); // pre-CRDT pages

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pageKeyCache = useRef<Map<string, CryptoKey>>(new Map());
  const isFirstLoad = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const savePageRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  // WebSocket. Exposed as state as well as a ref, because the collaboration hook has to
  // re-run when the socket actually opens, not just when the ref is written.
  useEffect(() => {
    if (!workspaceId || !isAuthenticated) return;
    const token = sessionStorage.getItem('access_token');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/${workspaceId}?token=${token}`;

    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => { if (wsRef.current === ws) setSocket(ws); };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Yjs traffic is handled by the collaboration hook's own listener.
          if (['page_updated', 'page_created', 'page_deleted'].includes(msg.type)) fetchPages();
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        setSocket(prev => (prev === ws ? null : prev));
        setTimeout(() => { if (wsRef.current === ws) connectWebSocket(); }, 3000);
      };
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    };
    connectWebSocket();
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      setSocket(null);
      ws?.close();
    };
  }, [workspaceId, isAuthenticated]);

  const sendCollab = useCallback((msg: CollabMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  // Fetch pages
  const fetchPages = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await api.get<PageTreeItem[]>(`/workspaces/${workspaceId}/pages`);
      setPages(data);
    } catch (e) { console.error('Failed to fetch pages:', e); }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      setActivePageId(null); setEditTitle(''); setEditContent(''); setEditIcon('');
      pageKeyCache.current.clear();
      fetchPages();
    }
  }, [workspaceId, fetchPages]);

  /**
   * Recover a page's AES key. There are two ways in, and a page may offer either:
   *
   *  - `encryptedPageKey` — wrapped under the workspace key. This is the normal path for
   *    workspace members, and it is the same blob for everyone, so a member who joined
   *    yesterday can still open a page written last year.
   *  - `grant` — wrapped directly to this user's RSA key. Only used for pages shared with
   *    someone outside the workspace.
   */
  const getPageKey = useCallback(async (
    pageId: string,
    encryptedPageKey: string | null,
    grant: string | null,
  ): Promise<CryptoKey | null> => {
    const cached = pageKeyCache.current.get(pageId);
    if (cached) return cached;

    let key: CryptoKey | null = null;
    if (encryptedPageKey && workspaceKey) {
      key = await unwrapPageKeyFromWorkspace(encryptedPageKey, workspaceKey);
    } else if (grant && privateKey) {
      key = await unwrapPageKey(grant, privateKey);
    }

    if (key) pageKeyCache.current.set(pageId, key);
    return key;
  }, [workspaceKey, privateKey]);

  /**
   * Turn a fetched page into editor state, reporting whether it actually opened.
   *
   * `locked` means the ciphertext is there but we could not read it — no key for this
   * user, or the key does not fit. The caller must not let the editor save over a locked
   * page: the plaintext exists only in the ciphertext we just failed to open.
   *
   * The body is handed on still encrypted. From v4 a page's content is a Yjs snapshot,
   * and the collaboration hook opens it into the shared document; older pages hold HTML,
   * which is decrypted here and seeded into a fresh document once.
   */
  const openPage = useCallback(async (
    pageId: string,
    data: PageData,
  ): Promise<{
    title: string; locked: boolean;
    key: CryptoKey | null; snapshot: string; legacy: string | null;
  }> => {
    const empty = { title: '', locked: false, key: null, snapshot: '', legacy: null };
    if (!data.title && !data.content) {
      const key = await getPageKey(pageId, data.encrypted_page_key, data.page_key_grant);
      return { ...empty, key };
    }

    try {
      const key = await getPageKey(pageId, data.encrypted_page_key, data.page_key_grant);
      if (!key) return { ...empty, locked: true };

      const title = data.title ? await decrypt(data.title, key) : '';
      const isCrdt = data.encryption_version >= 4;

      return {
        title,
        locked: false,
        key,
        snapshot: isCrdt ? data.content : '',
        legacy: !isCrdt && data.content ? await decrypt(data.content, key) : null,
      };
    } catch (e) {
      console.error('Failed to decrypt page:', pageId, e);
      return { ...empty, locked: true };
    }
  }, [getPageKey]);

  // Load page
  const loadPage = useCallback(async (pageId: string) => {
    if (!workspaceId) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; try { await savePageRef.current(); } catch { /* */ } }

    try {
      const data = await api.get<PageData>(`/workspaces/${workspaceId}/pages/${pageId}`);
      const opened = await openPage(pageId, data);

      setActivePageId(pageId);
      setEditTitle(opened.title);
      setEditContent('');
      setEditIcon(data.icon || '');
      setActivePageKey(opened.key);
      setSealedSnapshot(opened.snapshot);
      setLegacyHtml(opened.legacy);
      setPageLocked(opened.locked);
      setSharedPagePermission(null);
      setSaveStatus(opened.locked ? 'error' : 'idle');
      setTocHeadings([]);
      isFirstLoad.current = true;
    } catch (e) { console.error('Failed to load page:', e); }
  }, [workspaceId, openPage]);

  // Load shared page
  const loadSharedPage = useCallback(async (pageId: string) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; try { await savePageRef.current(); } catch { /* */ } }

    try {
      const data = await api.get<PageData & { permission: string }>(`/shared-pages/${pageId}`);
      const opened = await openPage(pageId, data);

      setActivePageId(pageId);
      setEditTitle(opened.title);
      setEditContent('');
      setEditIcon(data.icon || '');
      setActivePageKey(opened.key);
      setSealedSnapshot(opened.snapshot);
      setLegacyHtml(opened.legacy);
      setPageLocked(opened.locked);
      setSharedPagePermission(data.permission);
      setSaveStatus(opened.locked ? 'error' : 'idle');
      isFirstLoad.current = true;
    } catch (e) { console.error('Failed to load shared page:', e); }
  }, [openPage]);

  /**
   * Persist the page body: the merged Yjs snapshot, already encrypted by the hook.
   *
   * A whole-document write is safe here in a way it never was before. The snapshot is a
   * CRDT merge of everything this client has seen, including every remote edit relayed to
   * it, so a save cannot erase a concurrent edit — it has already absorbed it.
   */
  const persistDoc = useCallback(async (sealed: string) => {
    if (!activePageId || !workspaceId || pageLocked) return;
    setSaveStatus('saving');
    try {
      const path = sharedPagePermission !== null
        ? `/shared-pages/${activePageId}`
        : `/workspaces/${workspaceId}/pages/${activePageId}`;
      await api.put(path, { content: sealed, encryption_version: 4 });
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      console.error('Failed to persist page:', e);
    }
  }, [activePageId, workspaceId, pageLocked, sharedPagePermission]);

  const { doc: pageDoc, ready: docReady, seedHtml } = usePageDoc({
    pageId: activePageId,
    pageKey: activePageKey,
    sealedSnapshot,
    legacyHtml,
    socket,
    send: sendCollab,
    onPersist: persistDoc,
  });

  // Save page
  // Title and icon only. The body is a CRDT now and persists through persistDoc; these two
  // are plain fields where a last-writer-wins update is the expected behaviour anyway.
  const savePage = useCallback(async () => {
    if (!activePageId || !workspaceId) return;
    if (pageLocked) return; // never write over a page we could not read
    setSaveStatus('saving');
    try {
      const pageKey = pageKeyCache.current.get(activePageId);
      if (!pageKey) { setSaveStatus('error'); return; }

      const encTitle = await encrypt(editTitle || t.untitled, pageKey);
      const path = sharedPagePermission !== null
        ? `/shared-pages/${activePageId}`
        : `/workspaces/${workspaceId}/pages/${activePageId}`;
      await api.put(path, { title: encTitle, icon: editIcon });
      setSaveStatus('saved');
      fetchPages();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_updated', page_id: activePageId }));
      }
    } catch (e) { setSaveStatus('error'); console.error('Failed to save:', e); }
  }, [activePageId, workspaceId, editTitle, editIcon, pageLocked, sharedPagePermission, t.untitled, fetchPages]);

  useEffect(() => { savePageRef.current = savePage; }, [savePage]);

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (!activePageId) return;
    if (pageLocked) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(savePage, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editTitle, editIcon, savePage, activePageId, pageLocked]);

  // Create page. The page key is wrapped under the workspace key, not the creator's own
  // public key — that is what makes it readable by every member instead of only by us.
  const createPage = useCallback(async (parentId?: string) => {
    if (!workspaceId || !workspaceKey) return;
    try {
      const pageKey = await generatePageKey();
      const encTitle = await encrypt('', pageKey);
      const wrappedKey = await wrapPageKeyForWorkspace(pageKey, workspaceKey);

      const data = await api.post<PageData>(`/workspaces/${workspaceId}/pages`, {
        title: encTitle, content: '', parent_id: parentId || null, icon: '',
        encryption_version: 4, encrypted_page_key: wrappedKey,
      });
      pageKeyCache.current.set(data.id, pageKey);
      await fetchPages();
      loadPage(data.id);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_created', page_id: data.id }));
      }
    } catch (e) { console.error('Failed to create page:', e); }
  }, [workspaceId, workspaceKey, fetchPages, loadPage]);

  // Used by ShareModal to re-wrap a page key for an outside recipient.
  const getDecryptedPageKey = useCallback(async (pid: string): Promise<CryptoKey | null> => {
    if (!workspaceId) return null;
    const cached = pageKeyCache.current.get(pid);
    if (cached) return cached;
    try {
      const data = await api.get<PageData>(`/workspaces/${workspaceId}/pages/${pid}`);
      return await getPageKey(pid, data.encrypted_page_key, data.page_key_grant);
    } catch { return null; }
  }, [workspaceId, getPageKey]);

  // Create sub-page
  const createSubPage = useCallback(async (): Promise<{ id: string; title: string } | undefined> => {
    if (!activePageId || !workspaceId || !workspaceKey) return undefined;
    try {
      const pageKey = await generatePageKey();
      const subEncTitle = await encrypt(t.untitled, pageKey);
      const wrappedKey = await wrapPageKeyForWorkspace(pageKey, workspaceKey);

      const data = await api.post<PageData>(`/workspaces/${workspaceId}/pages`, {
        title: subEncTitle, content: '', parent_id: activePageId, icon: '',
        encryption_version: 4, encrypted_page_key: wrappedKey,
      });
      pageKeyCache.current.set(data.id, pageKey);
      await fetchPages();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_created', page_id: data.id }));
      }
      return { id: data.id, title: t.untitled };
    } catch (e) { console.error('Failed to create sub-page:', e); return undefined; }
  }, [activePageId, workspaceId, workspaceKey, fetchPages, t.untitled]);

  // Delete page
  const deletePage = useCallback(async (pageId: string) => {
    if (!workspaceId) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/pages/${pageId}`);
      if (activePageId === pageId) { setActivePageId(null); setEditTitle(''); setEditContent(''); setEditIcon(''); }
      pageKeyCache.current.delete(pageId);
      fetchPages();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_deleted', page_id: pageId }));
      }
    } catch (e) { console.error('Failed to delete page:', e); }
  }, [workspaceId, activePageId, fetchPages]);

  // Decrypt all page titles for the sidebar/search. A page we hold no key for is shown as
  // locked rather than "Untitled" — the old behaviour made unreadable pages indistinguishable
  // from genuinely blank ones.
  useEffect(() => {
    const decryptTitles = async () => {
      const map: Record<string, string> = {};
      for (const p of pages) {
        if (!p.title) { map[p.id] = t.untitled; continue; }
        try {
          const pageKey = await getPageKey(p.id, p.encrypted_page_key, null);
          map[p.id] = pageKey ? ((await decryptOrNull(p.title, pageKey)) ?? t.lockedPage) : t.lockedPage;
        } catch { map[p.id] = t.lockedPage; }
      }
      setSubPageTitles(map);
    };
    decryptTitles();
  }, [pages, getPageKey, t.untitled, t.lockedPage]);

  // Sub-pages of current page
  const subPages = useMemo(
    () => Object.entries(subPageTitles)
      .filter(([id]) => pages.find(p => p.id === id && p.parent_id === activePageId))
      .map(([id, title]) => ({ id, title: title || t.untitled, icon: pages.find(p => p.id === id)?.icon || '' })),
    [subPageTitles, pages, activePageId],
  );

  // Build icon map for all pages (used to sync sub-page link icons in editor)
  const subPageIcons = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pages) { map[p.id] = p.icon || ''; }
    return map;
  }, [pages]);

  // Workspace switching
  const handleSwitchWorkspace = useCallback((workspace: Workspace) => { switchWorkspace(workspace.id); }, [switchWorkspace]);
  const handleWorkspaceCreated = useCallback((workspace: Workspace) => { switchWorkspace(workspace.id); }, [switchWorkspace]);

  // Export
  const handleExportMarkdown = useCallback(() => {
    const md = htmlToMarkdown(editContent);
    downloadFile(`# ${editTitle || t.untitled}\n\n${md}`, `${editTitle || t.untitled}.md`, 'text/markdown;charset=utf-8');
  }, [editTitle, editContent]);
  const handleExportPDF = useCallback(() => { exportPDF(editTitle || t.untitled, editContent); }, [editTitle, editContent, t.untitled]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="w-7 h-7 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const decryptedTitle = editTitle || t.untitled;

  return (
    <div className="h-screen flex bg-[var(--bg-app)] text-[var(--fg-primary)]">
      <Sidebar
        pages={pages}
        activePageId={activePageId}
        onSelectPage={loadPage}
        onCreatePage={createPage}
        onDeletePage={deletePage}
        onOpenSearch={() => setShowSearch(true)}
        onOpenTrash={() => setShowTrash(true)}
        onOpenTips={() => setShowTips(true)}
        onSwitchWorkspace={handleSwitchWorkspace}
        onOpenWorkspaceSettings={(ws) => setSettingsWorkspace(ws)}
        onCreateWorkspace={() => setShowCreateWorkspace(true)}
        currentWorkspaceId={workspaceId}
        collapsed={!sidebarOpen}
        decryptedTitles={subPageTitles}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          saveStatus={saveStatus}
          pageTitle={activePageId ? decryptedTitle : undefined}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
          onShare={activePageId ? () => setShowShare(true) : undefined}
        />

        {activePageId && pageLocked ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md text-center">
              <Lock className="w-10 h-10 mx-auto mb-4 text-[var(--fg-muted)]" />
              <h2 className="text-lg font-medium mb-2">{t.lockedPage}</h2>
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{t.lockedPageNotice}</p>
            </div>
          </div>
        ) : activePageId && !docReady ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        ) : activePageId ? (
          <Editor
            key={activePageId}
            title={editTitle}
            content={seedHtml ?? ''}
            icon={editIcon}
            pageId={activePageId}
            ydoc={pageDoc}
            onChangeTitle={setEditTitle}
            onChangeContent={setEditContent}
            onChangeIcon={setEditIcon}
            subPages={subPages}
            onCreateSubPage={createSubPage}
            onNavigateToPage={sharedPagePermission !== null ? loadSharedPage : loadPage}
            subPageTitles={subPageTitles}
            subPageIcons={subPageIcons}
            onHeadingsChange={setTocHeadings}
          />
        ) : (
          <PageTreeView
            pages={pages}
            decryptedTitles={subPageTitles}
            activePageId={activePageId}
            onSelectPage={loadPage}
            onCreatePage={createPage}
          />
        )}
      </div>

      {rightPanelOpen && (
        <RightPanel content={editContent} title={decryptedTitle} onClose={() => setRightPanelOpen(false)} onExportMarkdown={handleExportMarkdown} onExportPDF={handleExportPDF} activePageId={activePageId} tocHeadings={tocHeadings} onOpenSharedPage={loadSharedPage} />
      )}

      {showSearch && <SearchModal pages={pages} decryptedTitles={subPageTitles} onSelect={loadPage} onClose={() => setShowSearch(false)} />}
      {showTrash && <TrashPanel workspaceId={workspaceId} onClose={() => setShowTrash(false)} onRestore={fetchPages} />}
      {settingsWorkspace && <WorkspaceSettings workspace={settingsWorkspace} onClose={() => setSettingsWorkspace(null)} onUpdated={fetchPages} />}
      {showCreateWorkspace && <CreateWorkspaceModal onClose={() => setShowCreateWorkspace(false)} onCreated={handleWorkspaceCreated} />}
      {showTips && <TipsModal onClose={() => setShowTips(false)} />}
      {showShare && activePageId && (
        <ShareModal workspaceId={workspaceId} pageId={activePageId} pageTitle={editTitle || t.untitled} allPages={pages} getDecryptedPageKey={getDecryptedPageKey} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
