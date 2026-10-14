import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Lock,
  Star,
  Sparkles,
  History,
  Settings,
  ArrowRightCircle,
  Columns,
  Maximize2,
  Sun,
  Moon,
  Search,
  Zap,
} from 'lucide-react';
import { BookmarkItem } from '../services/api';

interface ToolbarProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  bookmarks: BookmarkItem[];
  onAddBookmark: (url: string, title: string) => void;
  onSelectBookmark: (url: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  viewMode: 'split' | 'browser' | 'chat';
  onChangeViewMode: (mode: 'split' | 'browser' | 'chat') => void;
  onAskMuseQuick: (prompt: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentUrl,
  onNavigate,
  onBack,
  onForward,
  onReload,
  bookmarks,
  onAddBookmark,
  onSelectBookmark,
  sidebarOpen,
  onToggleSidebar,
  onOpenHistory,
  onOpenSettings,
  theme,
  onToggleTheme,
  viewMode,
  onChangeViewMode,
  onAskMuseQuick,
}) => {
  const [inputUrl, setInputUrl] = useState(currentUrl);

  useEffect(() => {
    setInputUrl(currentUrl);
  }, [currentUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputUrl.trim();
    if (!query) return;

    // If user typed a natural language instruction or query starting with 'ask:' or natural prompt
    if (
      query.toLowerCase().startsWith('ask:') ||
      query.toLowerCase().startsWith('lumina:') ||
      query.toLowerCase().startsWith('muse:')
    ) {
      const cleanPrompt = query.replace(/^(ask:|lumina:|muse:)\s*/i, '');
      onAskMuseQuick(cleanPrompt);
      return;
    }

    onNavigate(query);
  };

  const isBookmarked = bookmarks.some((b) => b.url === currentUrl);

  return (
    <>
      <div className="muse-toolbar">
        {/* Navigation History Buttons */}
        <div className="muse-nav-group">
          <button className="muse-tool-btn" onClick={onBack} title="Back (⌘[)">
            <ArrowLeft size={15} />
          </button>
          <button className="muse-tool-btn" onClick={onForward} title="Forward (⌘])">
            <ArrowRight size={15} />
          </button>
          <button className="muse-tool-btn" onClick={onReload} title="Reload (⌘R)">
            <RotateCw size={14} />
          </button>
        </div>

        {/* Omnibar / Address & Errand Input */}
        <form className="muse-omnibar" onSubmit={handleSubmit}>
          <div className="muse-omnibar-lock" title="Encrypted Connection (Lumina SI Secure VM)">
            <Lock size={13} color="#059669" />
          </div>

          <input
            type="text"
            className="muse-omnibar-input"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter web address or 'ask: compare laptops under $1000'..."
          />

          {/* Quick Ask Lumina SI Chip inside Omnibar */}
          {inputUrl.length > 5 && !inputUrl.startsWith('http') && (
            <button
              type="button"
              className="muse-omnibar-ask-chip"
              onClick={() => {
                onAskMuseQuick(inputUrl);
              }}
              title="Delegate this query directly to Lumina SI Agent"
            >
              <Zap size={11} /> Ask Lumina SI
            </button>
          )}

          {/* Bookmark Button */}
          <button
            type="button"
            className="muse-tool-btn inline"
            onClick={() => onAddBookmark(currentUrl, inputUrl)}
            title={isBookmarked ? 'Bookmarked' : 'Add to Bookmarks'}
          >
            <Star
              size={14}
              fill={isBookmarked ? '#f59e0b' : 'none'}
              color={isBookmarked ? '#f59e0b' : 'currentColor'}
            />
          </button>

          {/* Navigate / Execute Button */}
          <button type="submit" className="muse-omnibar-go-btn" title="Navigate">
            <ArrowRightCircle size={15} />
          </button>
        </form>

        {/* Right Tool Buttons */}
        <div className="muse-actions-group">
          {/* View Mode Switcher */}
          <div className="muse-viewmode-segmented">
            <button
              className={`segment-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('split')}
              title="Split View: Browser + Lumina SI"
            >
              <Columns size={13} />
            </button>
            <button
              className={`segment-btn ${viewMode === 'browser' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('browser')}
              title="Focus View: Browser Only"
            >
              <Maximize2 size={13} />
            </button>
          </div>

          {/* Theme Switcher */}
          <button
            className="muse-tool-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Pure White Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* History */}
          <button className="muse-tool-btn" onClick={onOpenHistory} title="Browsing History">
            <History size={15} />
          </button>

          {/* Settings */}
          <button className="muse-tool-btn" onClick={onOpenSettings} title="Settings & User Vault">
            <Settings size={15} />
          </button>

          {/* Toggle Lumina SI Panel */}
          <button
            className={`muse-tool-btn muse-agent-toggle ${sidebarOpen ? 'active' : ''}`}
            onClick={onToggleSidebar}
            title="Toggle Lumina SI Agent Panel"
          >
            <Sparkles size={15} />
            <span className="toggle-label">Lumina SI</span>
          </button>
        </div>
      </div>

      {/* Bookmarks Bar */}
      <div className="muse-bookmarks-bar">
        <div
          className="muse-bm-chip"
          onClick={() => onSelectBookmark('http://127.0.0.1:8765/test-site/laptops')}
        >
          💻 <span>Laptops Store</span>
        </div>
        <div
          className="muse-bm-chip"
          onClick={() => onSelectBookmark('http://127.0.0.1:8765/test-site/jobs')}
        >
          💼 <span>Careers Portal</span>
        </div>
        <div
          className="muse-bm-chip"
          onClick={() => onSelectBookmark('http://127.0.0.1:8765/test-site/booking')}
        >
          📅 <span>Appointment Booking</span>
        </div>
        <div
          className="muse-bm-chip"
          onClick={() => onSelectBookmark('https://en.wikipedia.org/wiki/Artificial_intelligence')}
        >
          🌐 <span>Wikipedia AI</span>
        </div>
        <div
          className="muse-bm-chip"
          onClick={() => onSelectBookmark('https://news.ycombinator.com')}
        >
          📰 <span>Hacker News</span>
        </div>

        {bookmarks.map((bm) => (
          <div
            key={bm.id}
            className="muse-bm-chip custom"
            onClick={() => onSelectBookmark(bm.url)}
            title={bm.url}
          >
            ⭐ <span>{bm.title || bm.url}</span>
          </div>
        ))}
      </div>
    </>
  );
};
