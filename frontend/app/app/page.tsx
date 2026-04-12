'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  encrypt, decrypt,
  generatePageKey, wrapPageKey, unwrapPageKey,
} from '@/lib/crypto';
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
import { FileText, Plus } from 'lucide-react';

export default function AppPage() {
  const { isAuthenticated, isLoading, workspaceId, privateKey, publicKey, switchWorkspace } = useAuth();
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

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pageKeyCache = useRef<Map<string, CryptoKey>>(new Map());
  const isFirstLoad = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const savePageRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  // WebSocket
  useEffect(() => {
    if (!workspaceId || !isAuthenticated) return;
    const token = sessionStorage.getItem('access_token');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/${workspaceId}?token=${token}`;

    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (['page_updated', 'page_created', 'page_deleted'].includes(msg.type)) fetchPages();
        } catch { /* ignore */ }
      };
      ws.onclose = () => { setTimeout(() => { if (wsRef.current === ws) connectWebSocket(); }, 3000); };
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    };
    connectWebSocket();
    return () => { if (wsRef.current) { const ws = wsRef.current; wsRef.current = null; ws.close(); } };
  }, [workspaceId, isAuthenticated]);

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

  // Helper: get or unwrap page key
  const getPageKey = useCallback(async (pageId: string, grant: string | null): Promise<CryptoKey | null> => {
    if (!privateKey || !grant) return null;
    let key = pageKeyCache.current.get(pageId);
    if (!key) {
      key = await unwrapPageKey(grant, privateKey);
      pageKeyCache.current.set(pageId, key);
    }
    return key;
  }, [privateKey]);

  // Load page
  const loadPage = useCallback(async (pageId: string) => {
    if (!workspaceId) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; try { await savePageRef.current(); } catch { /* */ } }

    try {
      const data = await api.get<PageData>(`/workspaces/${workspaceId}/pages/${pageId}`);
      const pageKey = await getPageKey(pageId, data.page_key_grant);
      const decryptedTitle = pageKey && data.title ? await decrypt(data.title, pageKey) : '';
      const decryptedContent = pageKey && data.content ? await decrypt(data.content, pageKey) : '';

      setActivePageId(pageId);
      setEditTitle(decryptedTitle);
      setEditContent(decryptedContent);
      setEditIcon(data.icon || '');
      setSharedPagePermission(null);
      setSaveStatus('idle');
      setTocHeadings([]);
      isFirstLoad.current = true;
    } catch (e) { console.error('Failed to load page:', e); }
  }, [workspaceId, getPageKey]);

  // Load shared page
  const loadSharedPage = useCallback(async (pageId: string) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; try { await savePageRef.current(); } catch { /* */ } }

    try {
      const data = await api.get<PageData & { permission: string; page_key_grant: string | null }>(`/shared-pages/${pageId}`);
      const pageKey = await getPageKey(pageId, data.page_key_grant);
      const decryptedTitle = pageKey && data.title ? await decrypt(data.title, pageKey) : '';
      const decryptedContent = pageKey && data.content ? await decrypt(data.content, pageKey) : '';

      setActivePageId(pageId);
      setEditTitle(decryptedTitle);
      setEditContent(decryptedContent);
      setEditIcon(data.icon || '');
      setSharedPagePermission(data.permission);
      setSaveStatus('idle');
      isFirstLoad.current = true;
    } catch (e) { console.error('Failed to load shared page:', e); }
  }, [getPageKey]);

  // Save page
  const savePage = useCallback(async () => {
    if (!activePageId || !workspaceId) return;
    setSaveStatus('saving');
    try {
      const pageKey = pageKeyCache.current.get(activePageId);
      if (!pageKey) { setSaveStatus('error'); return; }

      const encTitle = await encrypt(editTitle || 'Untitled', pageKey);
      const encContent = await encrypt(editContent, pageKey);
      await api.put(`/workspaces/${workspaceId}/pages/${activePageId}`, { title: encTitle, content: encContent, icon: editIcon });
      setSaveStatus('saved');
      fetchPages();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_updated', page_id: activePageId }));
      }
    } catch (e) { setSaveStatus('error'); console.error('Failed to save:', e); }
  }, [activePageId, workspaceId, editTitle, editContent, editIcon, fetchPages]);

  useEffect(() => { savePageRef.current = savePage; }, [savePage]);

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (!activePageId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(savePage, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editTitle, editContent, editIcon, savePage, activePageId]);

  // Create page
  const createPage = useCallback(async (parentId?: string) => {
    if (!workspaceId || !publicKey) return;
    try {
      const pageKey = await generatePageKey();
      const encTitle = await encrypt('', pageKey);
      const wrappedKey = await wrapPageKey(pageKey, publicKey);

      const data = await api.post<PageData>(`/workspaces/${workspaceId}/pages`, {
        title: encTitle, content: '', parent_id: parentId || null, icon: '',
        encryption_version: 2, encrypted_page_key: wrappedKey,
      });
      pageKeyCache.current.set(data.id, pageKey);
      await fetchPages();
      loadPage(data.id);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_created', page_id: data.id }));
      }
    } catch (e) { console.error('Failed to create page:', e); }
  }, [workspaceId, publicKey, fetchPages, loadPage]);

  // Decrypt a page key by fetching its grant (used by ShareModal for recursive key sharing)
  const getDecryptedPageKey = useCallback(async (pid: string): Promise<CryptoKey | null> => {
    if (!workspaceId || !privateKey) return null;
    let key = pageKeyCache.current.get(pid);
    if (!key) {
      try {
        const data = await api.get<{ page_key_grant: string | null }>(`/workspaces/${workspaceId}/pages/${pid}`);
        if (data.page_key_grant) {
          key = await unwrapPageKey(data.page_key_grant, privateKey);
          pageKeyCache.current.set(pid, key);
        }
      } catch { return null; }
    }
    return key ?? null;
  }, [workspaceId, privateKey]);

  // Save content explicitly
  const saveContent = useCallback(async (html: string) => {
    if (!activePageId || !workspaceId) return;
    try {
      const pageKey = pageKeyCache.current.get(activePageId);
      if (!pageKey) return;
      const encTitle = await encrypt(editTitle || 'Untitled', pageKey);
      const encContent = await encrypt(html, pageKey);
      await api.put(`/workspaces/${workspaceId}/pages/${activePageId}`, { title: encTitle, content: encContent, icon: editIcon });
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    } catch (e) { console.error('Failed to save content:', e); }
  }, [activePageId, workspaceId, editTitle, editIcon]);

  // Create sub-page
  const createSubPage = useCallback(async (): Promise<{ id: string; title: string } | undefined> => {
    if (!activePageId || !workspaceId || !publicKey) return undefined;
    try {
      const pageKey = await generatePageKey();
      const subEncTitle = await encrypt('Untitled', pageKey);
      const wrappedKey = await wrapPageKey(pageKey, publicKey);

      const data = await api.post<PageData>(`/workspaces/${workspaceId}/pages`, {
        title: subEncTitle, content: '', parent_id: activePageId, icon: '',
        encryption_version: 2, encrypted_page_key: wrappedKey,
      });
      pageKeyCache.current.set(data.id, pageKey);
      await fetchPages();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_created', page_id: data.id }));
      }
      return { id: data.id, title: 'Untitled' };
    } catch (e) { console.error('Failed to create sub-page:', e); return undefined; }
  }, [activePageId, workspaceId, publicKey, fetchPages]);

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

  // Decrypt all page titles
  useEffect(() => {
    const decryptTitles = async () => {
      const map: Record<string, string> = {};
      for (const p of pages) {
        if (p.encrypted_page_key && privateKey) {
          try {
            const pageKey = await getPageKey(p.id, p.encrypted_page_key);
            map[p.id] = pageKey && p.title ? await decrypt(p.title, pageKey) : 'Untitled';
          } catch { map[p.id] = 'Untitled'; }
        } else {
          map[p.id] = 'Untitled';
        }
      }
      setSubPageTitles(map);
    };
    decryptTitles();
  }, [pages, privateKey, getPageKey]);

  // Sub-pages of current page
  const subPages = useMemo(
    () => Object.entries(subPageTitles)
      .filter(([id]) => pages.find(p => p.id === id && p.parent_id === activePageId))
      .map(([id, title]) => ({ id, title: title || 'Untitled', icon: pages.find(p => p.id === id)?.icon || '' })),
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
    downloadFile(`# ${editTitle || 'Untitled'}\n\n${md}`, `${editTitle || 'Untitled'}.md`, 'text/markdown;charset=utf-8');
  }, [editTitle, editContent]);
  const handleExportPDF = useCallback(() => { exportPDF(editTitle || 'Untitled', editContent); }, [editTitle, editContent]);

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

  const decryptedTitle = editTitle || 'Untitled';

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

        {activePageId ? (
          <Editor
            title={editTitle}
            content={editContent}
            icon={editIcon}
            pageId={activePageId}
            onChangeTitle={setEditTitle}
            onChangeContent={setEditContent}
            onChangeIcon={setEditIcon}
            subPages={subPages}
            onCreateSubPage={createSubPage}
            onNavigateToPage={sharedPagePermission !== null ? loadSharedPage : loadPage}
            onSaveContent={saveContent}
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
        <ShareModal workspaceId={workspaceId} pageId={activePageId} pageTitle={editTitle || 'Untitled'} allPages={pages} getDecryptedPageKey={getDecryptedPageKey} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
