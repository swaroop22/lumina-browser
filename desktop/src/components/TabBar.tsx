import React from 'react';
import { Plus, X, Globe } from 'lucide-react';
import { TabItem } from '../services/api';
import { StatusPill } from './StatusPill';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  // Status Pill props
  status?: string;
  currentStepDescription?: string;
  stepIndex?: number;
  totalSteps?: number;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onPauseTask?: () => void;
  onResumeTask?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onNewTab,
  status,
  currentStepDescription,
  stepIndex,
  totalSteps,
  isSidebarOpen,
  onToggleSidebar,
  onPauseTask,
  onResumeTask,
}) => {
  return (
    <div className="muse-tab-bar-container">
      {/* 1. Window Traffic Lights */}
      <div className="muse-window-controls">
        <span className="muse-dot close" />
        <span className="muse-dot minimize" />
        <span className="muse-dot maximize" />
      </div>

      {/* 2. Tabs Strip */}
      <div className="muse-tabs-scroll-area">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`muse-tab-item ${isActive ? 'active' : ''}`}
              onClick={() => onSwitchTab(tab.id)}
              title={tab.url}
            >
              <Globe
                size={13}
                className="muse-tab-icon"
                style={{ color: isActive ? '#8b5cf6' : 'currentColor' }}
              />
              <span className="muse-tab-title">{tab.title || 'New Tab'}</span>
              <button
                className="muse-tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                title="Close Tab"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}

        <button className="muse-new-tab-btn" onClick={onNewTab} title="Open New Tab">
          <Plus size={14} />
        </button>
      </div>

      {/* 3. Persistent Muse Mascot & Status Pill (Alex Cornell Design Signature) */}
      <div className="muse-header-pill-wrapper">
        <StatusPill
          status={status}
          currentStepDescription={currentStepDescription}
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={onToggleSidebar}
          onPauseTask={onPauseTask}
          onResumeTask={onResumeTask}
        />
      </div>
    </div>
  );
};
