import React from 'react';
import { Mascot, MascotMood } from './Mascot';
import { Sparkles, ShieldAlert, CheckCircle, Pause, Play, AlertCircle } from 'lucide-react';

interface StatusPillProps {
  status?: string; // 'pending' | 'planning' | 'running' | 'paused' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled'
  currentStepDescription?: string;
  stepIndex?: number;
  totalSteps?: number;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onPauseTask?: () => void;
  onResumeTask?: () => void;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status = 'idle',
  currentStepDescription,
  stepIndex = 0,
  totalSteps = 0,
  isSidebarOpen,
  onToggleSidebar,
  onPauseTask,
  onResumeTask,
}) => {
  // Determine mascot mood
  let mood: MascotMood = 'idle';
  let pillText = 'Lumina SI is ready';
  let badgeColor = '#64748b';
  let isPulsing = false;

  if (status === 'planning') {
    mood = 'thinking';
    pillText = 'Lumina SI is planning next steps...';
    badgeColor = '#7c3aed';
    isPulsing = true;
  } else if (status === 'running') {
    mood = 'browsing';
    pillText = currentStepDescription
      ? `Lumina SI: ${currentStepDescription}`
      : 'Lumina SI is navigating & executing...';
    badgeColor = '#059669';
    isPulsing = true;
  } else if (status === 'waiting_for_approval') {
    mood = 'waiting_for_approval';
    pillText = 'Approval Required · Category C Gate';
    badgeColor = '#d97706';
    isPulsing = true;
  } else if (status === 'paused') {
    mood = 'paused';
    pillText = 'Lumina SI is paused (Manual control)';
    badgeColor = '#0284c7';
  } else if (status === 'completed') {
    mood = 'completed';
    pillText = 'Task completed successfully';
    badgeColor = '#059669';
  } else if (status === 'failed' || status === 'cancelled') {
    mood = 'failed';
    pillText = status === 'cancelled' ? 'Task halted by user' : 'Task encountered an issue';
    badgeColor = '#e11d48';
  }

  return (
    <div
      className="muse-status-pill-container"
      onClick={onToggleSidebar}
      title="Click to toggle Lumina SI Agent panel"
    >
      {/* Animated Mascot */}
      <Mascot mood={mood} size={24} showHalo={isPulsing} />

      {/* Pulsing Status Dot */}
      <span
        className={`muse-status-dot ${isPulsing ? 'pulsing' : ''}`}
        style={{
          background: badgeColor,
          boxShadow: isPulsing ? `0 0 8px ${badgeColor}` : 'none',
        }}
      />

      {/* Human Text Label */}
      <span className="muse-status-text" title={pillText}>
        {pillText}
      </span>

      {/* Step Indicator if task active */}
      {totalSteps > 0 && (status === 'running' || status === 'planning') && (
        <span className="muse-step-counter">
          {stepIndex + 1}/{totalSteps}
        </span>
      )}

      {/* Quick Pause / Resume if running */}
      {status === 'running' && onPauseTask && (
        <button
          className="muse-pill-quick-action"
          onClick={(e) => {
            e.stopPropagation();
            onPauseTask();
          }}
          title="Pause Lumina SI"
        >
          <Pause size={12} />
        </button>
      )}

      {status === 'paused' && onResumeTask && (
        <button
          className="muse-pill-quick-action resume"
          onClick={(e) => {
            e.stopPropagation();
            onResumeTask();
          }}
          title="Resume Lumina SI"
        >
          <Play size={12} />
        </button>
      )}
    </div>
  );
};
