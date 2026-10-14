import React, { useState, useEffect, useRef } from 'react';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { BrowserViewport, BrowserViewportHandle } from './components/BrowserViewport';
import { AiSidebar } from './components/AiSidebar';
import { ApprovalModal } from './components/ApprovalModal';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import {
  fetchTabs,
  createTab,
  switchTab,
  closeTab,
  navigateBrowser,
  goBack,
  goForward,
  reloadBrowser,
  fetchBookmarks,
  addBookmark,
  fetchHistory,
  clearHistory,
  startTask,
  getTask,
  pauseTask,
  resumeTask,
  cancelTask,
  getPendingApprovals,
  decideApproval,
  TabItem,
  TaskRecord,
  BookmarkItem,
  HistoryItem,
  ApprovalItem,
} from './services/api';
import { resolveInputToUrl } from './services/urlResolver';

export const App: React.FC = () => {
  // Theme & Appearance (Default pure white as requested)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [viewMode, setViewMode] = useState<'split' | 'browser' | 'chat'>('split');

  // Viewport ref for direct webview orchestration
  const viewportRef = useRef<BrowserViewportHandle>(null);

  // Tabs & Navigation state
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: 'tab_1',
      title: 'TechVault - Laptops Catalog',
      url: 'http://127.0.0.1:8765/test-site/laptops',
      is_active: true,
      created_at: Date.now(),
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_1');
  const [currentUrl, setCurrentUrl] = useState<string>('http://127.0.0.1:8765/test-site/laptops');

  // Bookmarks & History
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Lumina SI AI & Tasks
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [isUserInControl, setIsUserInControl] = useState<boolean>(false);

  // Approvals & Modals
  const [pendingApproval, setPendingApproval] = useState<ApprovalItem | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);

  // Apply theme class to document body & html
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync tabs and backend state on mount
  useEffect(() => {
    loadTabs();
    loadBookmarks();

    if ((window as any).luminaDesktop?.onOpenUrlInTab) {
      (window as any).luminaDesktop.onOpenUrlInTab((url: string) => {
        handleNavigate(url);
      });
    }
  }, []);

  // Poll tabs, task status, and approvals every second
  useEffect(() => {
    const interval = setInterval(async () => {
      // 1. Check for pending Category C approvals
      try {
        const approvals = await getPendingApprovals();
        if (approvals.length > 0) {
          setPendingApproval(approvals[0]);
        } else {
          setPendingApproval(null);
        }
      } catch (err) {}

      // 2. Check active task progress
      if (activeTaskId) {
        try {
          const task = await getTask(activeTaskId);
          setActiveTask(task);

          if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
            setIsUserInControl(false);
          }

          // Automatically synchronize webview viewport when autonomous agent navigates to a new page
          if (task.executed_steps && task.executed_steps.length > 0) {
            const lastStep = task.executed_steps[task.executed_steps.length - 1];
            if (lastStep.tool === 'navigate' && lastStep.output?.url) {
              const dest = lastStep.output.url;
              if (dest && dest !== 'about:blank' && !dest.includes('blocked')) {
                setCurrentUrl((prev) => (prev !== dest ? dest : prev));
              }
            }
          }
        } catch (err) {}
      }

      // 3. Keep active tabs synchronized with backend
      try {
        const res = await fetchTabs();
        if (res && res.tabs && res.tabs.length > 0) {
          setTabs(res.tabs);
          const active = res.tabs.find((t) => t.id === res.active_tab_id) || res.tabs[0];
          if (active && active.url && !active.url.startsWith('about:') && !active.url.includes('blocked')) {
            setCurrentUrl((prev) => {
              // Update if changed externally by backend agent
              if (active.url !== prev && !prev.includes(active.url)) {
                return active.url;
              }
              return prev;
            });
          }
        }
      } catch (err) {}
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTaskId]);

  const loadTabs = async () => {
    try {
      const res = await fetchTabs();
      if (res && res.tabs && res.tabs.length > 0) {
        setTabs(res.tabs);
        setActiveTabId(res.active_tab_id || res.tabs[0].id);
        const active = res.tabs.find((t) => t.id === res.active_tab_id) || res.tabs[0];
        if (active && active.url && !active.url.startsWith('about:') && !active.url.includes('blocked')) {
          setCurrentUrl(active.url);
        }
      }
    } catch (err) {}
  };

  const loadBookmarks = async () => {
    try {
      const data = await fetchBookmarks();
      setBookmarks(data);
    } catch (err) {}
  };

  const loadHistory = async () => {
    try {
      const data = await fetchHistory();
      setHistory(data);
    } catch (err) {}
  };

  // Browser navigation handlers
  const handleNavigate = async (url: string) => {
    const cleanUrl = resolveInputToUrl(url);

    setCurrentUrl(cleanUrl);

    // Tell backend agent
    try {
      await navigateBrowser(cleanUrl);
      loadTabs();
    } catch (err) {
      console.error('Navigate backend sync error', err);
    }
  };

  const handleBack = async () => {
    if (viewportRef.current) {
      viewportRef.current.goBack();
    }
    try {
      const res = await goBack();
      if (res?.url) setCurrentUrl(res.url);
      loadTabs();
    } catch (err) {}
  };

  const handleForward = async () => {
    if (viewportRef.current) {
      viewportRef.current.goForward();
    }
    try {
      const res = await goForward();
      if (res?.url) setCurrentUrl(res.url);
      loadTabs();
    } catch (err) {}
  };

  const handleReload = async () => {
    if (viewportRef.current) {
      viewportRef.current.reload();
    }
    try {
      await reloadBrowser();
    } catch (err) {}
  };

  const handleSwitchTab = async (id: string) => {
    setActiveTabId(id);
    const target = tabs.find((t) => t.id === id);
    if (target && target.url && target.url !== 'about:blank') {
      setCurrentUrl(target.url);
    }
    try {
      await switchTab(id);
    } catch (err) {}
  };

  const handleCloseTab = async (id: string) => {
    try {
      await closeTab(id);
      loadTabs();
    } catch (err) {}
  };

  const handleNewTab = async () => {
    try {
      const newTab = await createTab('http://127.0.0.1:8765/test-site/laptops');
      loadTabs();
      if (newTab) {
        setActiveTabId(newTab.id);
        setCurrentUrl(newTab.url);
      }
    } catch (err) {}
  };

  const handleAddBookmark = async (url: string, title: string) => {
    try {
      await addBookmark(url, title || url);
      loadBookmarks();
    } catch (err) {}
  };

  // Lumina SI Agent Handlers
  const handleStartTask = async (instruction: string, mode: string) => {
    try {
      setIsUserInControl(false);
      let target = currentUrl;
      const lower = instruction.toLowerCase().trim();

      // Check if user instruction specifies or implies a web destination
      const resolvedTarget = resolveInputToUrl(instruction);
      if (
        resolvedTarget &&
        !resolvedTarget.includes('google.com/search') &&
        (lower.includes('open') || lower.includes('go to') || lower.includes('visit') || lower.includes('linkedin') || lower.includes('youtube') || lower.includes('github') || lower.includes('google'))
      ) {
        target = resolvedTarget;
      } else if (!target || target.startsWith('about:') || target.includes('blocked')) {
        target = 'http://127.0.0.1:8765/test-site/laptops';
      }

      // Immediately navigate viewport to target if resolved
      if (target && target !== currentUrl) {
        setCurrentUrl(target);
        try {
          await navigateBrowser(target);
        } catch (e) {}
      }

      const res = await startTask(instruction, mode, target);
      setActiveTaskId(res.task_id);
      setSidebarOpen(true);
      if (viewMode === 'browser') {
        setViewMode('split');
      }
    } catch (err) {
      console.error('Error starting task', err);
    }
  };

  const handlePauseTask = async (taskId?: string) => {
    const id = taskId || activeTaskId;
    if (id) {
      await pauseTask(id);
    }
  };

  const handleResumeTask = async (taskId?: string) => {
    const id = taskId || activeTaskId;
    if (id) {
      await resumeTask(id);
      setIsUserInControl(false);
    }
  };

  const handleCancelTask = async (taskId?: string) => {
    const id = taskId || activeTaskId;
    if (id) {
      await cancelTask(id);
      setIsUserInControl(false);
    }
  };

  const handleTakeControl = async () => {
    if (activeTaskId) {
      await pauseTask(activeTaskId);
    }
    setIsUserInControl(true);
  };

  const handleHandBackToMuse = async () => {
    if (activeTaskId) {
      await resumeTask(activeTaskId);
    }
    setIsUserInControl(false);
  };

  const handleDecideApproval = async (approvalId: string, approved: boolean, reason?: string) => {
    await decideApproval(approvalId, approved, reason || '');
    setPendingApproval(null);
  };

  const handleAskMuseQuick = (prompt: string) => {
    setSidebarOpen(true);
    setViewMode('split');
    handleStartTask(prompt, 'autonomous');
  };

  return (
    <div className={`muse-app-root theme-${theme}`}>
      {/* 1. Header with Window Controls, Tabs & Centered Lumina SI Status Pill */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={handleSwitchTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        status={activeTask?.status || 'idle'}
        currentStepDescription={activeTask?.current_step_description}
        stepIndex={activeTask?.step_index}
        totalSteps={activeTask?.plan?.length}
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onPauseTask={handleTakeControl}
        onResumeTask={handleHandBackToMuse}
      />

      {/* 2. Omnibar & Bookmarks Strip */}
      <Toolbar
        currentUrl={currentUrl}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        bookmarks={bookmarks}
        onAddBookmark={handleAddBookmark}
        onSelectBookmark={handleNavigate}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenHistory={() => {
          loadHistory();
          setHistoryModalOpen(true);
        }}
        onOpenSettings={() => setSettingsModalOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          setViewMode(mode);
          if (mode === 'browser') setSidebarOpen(false);
          else setSidebarOpen(true);
        }}
        onAskMuseQuick={handleAskMuseQuick}
      />

      {/* 3. Main Workspace: Browser Viewport + 3-Tier Progressive Disclosure Panel */}
      <div className={`muse-workspace-layout mode-${viewMode}`}>
        {/* Browser Viewport */}
        {(viewMode === 'split' || viewMode === 'browser') && (
          <BrowserViewport
            ref={viewportRef}
            currentUrl={currentUrl}
            onUrlChange={(url) => {
              if (!url || url.startsWith('about:') || url.includes('blocked')) return;
              setCurrentUrl(url);
              // Update tab title/url
              setTabs((prev) =>
                prev.map((t) => (t.id === activeTabId ? { ...t, url } : t))
              );
            }}
            onTitleChange={(title) => {
              setTabs((prev) =>
                prev.map((t) => (t.id === activeTabId ? { ...t, title } : t))
              );
            }}
            activeTaskStatus={activeTask?.status}
            currentStepDescription={activeTask?.current_step_description}
            isUserInControl={isUserInControl}
            onTakeControl={handleTakeControl}
            onHandBackToMuse={handleHandBackToMuse}
            onStopTask={() => handleCancelTask()}
            onReload={handleReload}
          />
        )}

        {/* Lumina SI Progressive Disclosure Panel */}
        {sidebarOpen && (
          <AiSidebar
            isOpen={sidebarOpen}
            onClose={() => {
              setSidebarOpen(false);
              setViewMode('browser');
            }}
            activeTask={activeTask}
            onStartTask={handleStartTask}
            onPauseTask={handlePauseTask}
            onResumeTask={handleResumeTask}
            onCancelTask={handleCancelTask}
          />
        )}
      </div>

      {/* 4. Consequential Action Gate Approval Dialog (Category C) */}
      <ApprovalModal
        approval={pendingApproval}
        onDecide={handleDecideApproval}
      />

      {/* 5. Browsing & Errand History Modal */}
      <HistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        history={history}
        onClearHistory={async () => {
          await clearHistory();
          setHistory([]);
        }}
        onNavigate={handleNavigate}
      />

      {/* 6. Settings & User Vault Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
};
