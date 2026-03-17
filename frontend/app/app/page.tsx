'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { encrypt, decrypt } from '@/lib/crypto';
import type { PageTreeItem, PageData, Workspace } from '@/lib/types';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import RightPanel from '@/components/layout/RightPanel';
import Editor from '@/components/editor/Editor';
import SearchModal from '@/components/search/SearchModal';
import TrashPanel from '@/components/layout/TrashPanel';
import WorkspaceSettings from '@/components/workspace/WorkspaceSettings';
import CreateWorkspaceModal from '@/components/workspace/CreateWorkspaceModal';
import TipsModal from '@/components/ui/TipsModal';
import ProfileModal from '@/components/ui/ProfileModal';
import { htmlToMarkdown, downloadFile, exportPDF } from '@/lib/export';
import { FileText, Plus } from 'lucide-react';

export default function AppPage() {
  const { isAuthenticated, isLoading, workspaceId, encKey, switchWorkspace } = useAuth();
  const router = useRouter();

  const [pages, setPages] = useState<PageTreeItem[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [settingsWorkspace, setSettingsWorkspace] = useState<Workspace | null>(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!workspaceId || !isAuthenticated) return;

    const token = sessionStorage.getItem('access_token');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/${workspaceId}?token=${token}`;

    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'page_updated' || msg.type === 'page_created' || msg.type === 'page_deleted') {
            fetchPages();
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setTimeout(() => {
          if (wsRef.current === ws) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.close();
      }
    };
  }, [workspaceId, isAuthenticated]);

  // Fetch pages
  const fetchPages = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await api.get<PageTreeItem[]>(`/workspaces/${workspaceId}/pages`);
      setPages(data);
    } catch (e) {
      console.error('Failed to fetch pages:', e);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      setActivePageId(null);
      setEditTitle('');
      setEditContent('');
      setEditIcon('');
      fetchPages();
    }
  }, [workspaceId, fetchPages]);

  // Load page content
  const loadPage = useCallback(async (pageId: string) => {
    if (!workspaceId) return;
    try {
      const data = await api.get<PageData>(`/workspaces/${workspaceId}/pages/${pageId}`);
      const decryptedTitle = decrypt(data.title, encKey) || '';
      const decryptedContent = decrypt(data.content, encKey) || '';
      setActivePageId(pageId);
      setEditTitle(decryptedTitle);
      setEditContent(decryptedContent);
      setEditIcon(data.icon || '');
      setSaveStatus('idle');
      isFirstLoad.current = true;
    } catch (e) {
      console.error('Failed to load page:', e);
    }
  }, [workspaceId, encKey]);

  // Auto-save with WebSocket broadcast
  const savePage = useCallback(async () => {
    if (!activePageId || !workspaceId) return;
    setSaveStatus('saving');
    try {
      const encTitle = encrypt(editTitle || 'Untitled', encKey);
      const encContent = encrypt(editContent, encKey);
      await api.put(`/workspaces/${workspaceId}/pages/${activePageId}`, {
        title: encTitle,
        content: encContent,
        icon: editIcon,
      });
      setSaveStatus('saved');
      fetchPages();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'page_updated',
          page_id: activePageId,
        }));
      }
    } catch (e) {
      setSaveStatus('error');
      console.error('Failed to save:', e);
    }
  }, [activePageId, workspaceId, editTitle, editContent, editIcon, encKey, fetchPages]);

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    if (!activePageId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(savePage, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editTitle, editContent, editIcon, savePage, activePageId]);

  // Create page
  const createPage = useCallback(async (parentId?: string) => {
    if (!workspaceId) return;
    try {
      const encTitle = encrypt('', encKey);
      const data = await api.post<PageData>(`/workspaces/${workspaceId}/pages`, {
        title: encTitle,
        content: '',
        parent_id: parentId || null,
        icon: '',
      });
      await fetchPages();
      loadPage(data.id);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_created', page_id: data.id }));
      }
    } catch (e) {
      console.error('Failed to create page:', e);
    }
  }, [workspaceId, encKey, fetchPages, loadPage]);

  // Create sub-page (child of current page) without navigating away
  const createSubPage = useCallback(async (): Promise<{ id: string; title: string } | undefined> => {
    if (!activePageId || !workspaceId) return undefined;
    try {
      // Save current page first
      const encTitle = encrypt(editTitle || 'Untitled', encKey);
      const encContent = encrypt(editContent, encKey);
      await api.put(`/workspaces/${workspaceId}/pages/${activePageId}`, {
        title: encTitle,
        content: encContent,
        icon: editIcon,
      });

      // Create the sub-page
      const subEncTitle = encrypt('Untitled', encKey);
      const data = await api.post<PageData>(`/workspaces/${workspaceId}/pages`, {
        title: subEncTitle,
        content: '',
        parent_id: activePageId,
        icon: '',
      });
      await fetchPages();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_created', page_id: data.id }));
      }
      return { id: data.id, title: 'Untitled' };
    } catch (e) {
      console.error('Failed to create sub-page:', e);
      return undefined;
    }
  }, [activePageId, workspaceId, editTitle, editContent, editIcon, encKey, fetchPages]);

  // Delete page (soft)
  const deletePage = useCallback(async (pageId: string) => {
    if (!workspaceId) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/pages/${pageId}`);
      if (activePageId === pageId) {
        setActivePageId(null);
        setEditTitle('');
        setEditContent('');
        setEditIcon('');
      }
      fetchPages();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'page_deleted', page_id: pageId }));
      }
    } catch (e) {
      console.error('Failed to delete page:', e);
    }
  }, [workspaceId, activePageId, fetchPages]);

  // Get sub-pages of current page (decrypted)
  const subPages = useMemo(() => {
    if (!activePageId) return [];
    return pages
      .filter(p => p.parent_id === activePageId)
      .map(p => ({
        id: p.id,
        title: decrypt(p.title, encKey) || 'Untitled',
        icon: p.icon || '',
      }));
  }, [pages, activePageId, encKey]);

  // Workspace switching
  const handleSwitchWorkspace = useCallback((workspace: Workspace) => {
    switchWorkspace(workspace.id);
  }, [switchWorkspace]);

  const handleWorkspaceCreated = useCallback((workspace: Workspace) => {
    switchWorkspace(workspace.id);
  }, [switchWorkspace]);

  // Export functions
  const handleExportMarkdown = useCallback(() => {
    const md = htmlToMarkdown(editContent);
    const filename = `${editTitle || 'Untitled'}.md`;
    const fullContent = `# ${editTitle || 'Untitled'}\n\n${md}`;
    downloadFile(fullContent, filename, 'text/markdown;charset=utf-8');
  }, [editTitle, editContent]);

  const handleExportPDF = useCallback(() => {
    exportPDF(editTitle || 'Untitled', editContent);
  }, [editTitle, editContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const decryptedTitle = editTitle || 'Untitled';

  return (
    <div className="h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Sidebar */}
      <Sidebar
        pages={pages}
        activePageId={activePageId}
        onSelectPage={loadPage}
        onCreatePage={createPage}
        onDeletePage={deletePage}
        onOpenSearch={() => setShowSearch(true)}
        onOpenTrash={() => setShowTrash(true)}
        onOpenTips={() => setShowTips(true)}
        onOpenProfile={() => setShowProfile(true)}
        onSwitchWorkspace={handleSwitchWorkspace}
        onOpenWorkspaceSettings={(ws) => setSettingsWorkspace(ws)}
        onCreateWorkspace={() => setShowCreateWorkspace(true)}
        currentWorkspaceId={workspaceId}
        collapsed={!sidebarOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          saveStatus={saveStatus}
          pageTitle={activePageId ? decryptedTitle : undefined}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={activePageId ? () => setRightPanelOpen(!rightPanelOpen) : undefined}
        />

        {activePageId ? (
          <Editor
            title={editTitle}
            content={editContent}
            icon={editIcon}
            onChangeTitle={setEditTitle}
            onChangeContent={setEditContent}
            onChangeIcon={setEditIcon}
            subPages={subPages}
            onCreateSubPage={createSubPage}
            onNavigateToPage={loadPage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-6">
                <FileText size={32} className="text-neutral-400" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                Select a page or create a new one
              </h2>
              <p className="text-neutral-500 mb-6">Your notes are encrypted end-to-end</p>
              <button
                onClick={() => createPage()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
              >
                <Plus size={18} />
                New Page
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel */}
      {activePageId && rightPanelOpen && (
        <RightPanel
          content={editContent}
          title={decryptedTitle}
          onClose={() => setRightPanelOpen(false)}
          onExportMarkdown={handleExportMarkdown}
          onExportPDF={handleExportPDF}
        />
      )}

      {/* Modals */}
      {showSearch && (
        <SearchModal
          pages={pages}
          onSelect={loadPage}
          onClose={() => setShowSearch(false)}
        />
      )}
      {showTrash && (
        <TrashPanel
          workspaceId={workspaceId}
          onClose={() => setShowTrash(false)}
          onRestore={fetchPages}
        />
      )}
      {settingsWorkspace && (
        <WorkspaceSettings
          workspace={settingsWorkspace}
          onClose={() => setSettingsWorkspace(null)}
          onUpdated={fetchPages}
        />
      )}
      {showCreateWorkspace && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWorkspace(false)}
          onCreated={handleWorkspaceCreated}
        />
      )}
      {showTips && <TipsModal onClose={() => setShowTips(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
