import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  Square,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  ShieldAlert,
  FileText,
  X,
  Code2,
  ListTodo,
  MessageSquare,
  Eye,
  Sliders,
  Copy,
  Check,
  Send,
  Zap,
} from 'lucide-react';
import { TaskRecord } from '../services/api';
import { Mascot, MascotMood } from './Mascot';

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTask: TaskRecord | null;
  onStartTask: (instruction: string, mode: string) => void;
  onPauseTask: (id: string) => void;
  onResumeTask: (id: string) => void;
  onCancelTask: (id: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'lumina';
  text: string;
  timestamp: number;
  taskSnapshot?: TaskRecord;
}

export const AiSidebar: React.FC<AiSidebarProps> = ({
  isOpen,
  onClose,
  activeTask,
  onStartTask,
  onPauseTask,
  onResumeTask,
  onCancelTask,
}) => {
  const [instruction, setInstruction] = useState('');
  const [mode, setMode] = useState('autonomous');
  const [activeTier, setActiveTier] = useState<'chat' | 'plan' | 'inspect'>('chat');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Local persistent chat history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'lumina',
      text: "Hello! I'm Lumina SI, your autonomous personal browser companion. Tell me what you'd like to accomplish on the web—I can research and compare products, fill out multi-step applications, schedule appointments, or extract structured intelligence from pages.",
      timestamp: Date.now(),
    },
  ]);

  // Keep track of tasks added to chat
  const lastLoggedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeTask && activeTask.id !== lastLoggedTaskIdRef.current) {
      lastLoggedTaskIdRef.current = activeTask.id;
      setMessages((prev) => [
        ...prev,
        {
          id: `task-start-${activeTask.id}`,
          sender: 'lumina',
          text: `Starting errand: "${activeTask.instruction}". I will observe the page, construct an execution plan, and carry out each step with automated verification.`,
          timestamp: Date.now(),
          taskSnapshot: activeTask,
        },
      ]);
    }
  }, [activeTask?.id]);

  // When task completes, fails, or cancels
  useEffect(() => {
    if (activeTask && activeTask.status === 'completed' && activeTask.results?.summary) {
      setMessages((prev) => {
        const alreadyAdded = prev.some((m) => m.id === `task-complete-${activeTask.id}`);
        if (alreadyAdded) return prev;
        return [
          ...prev,
          {
            id: `task-complete-${activeTask.id}`,
            sender: 'lumina',
            text: `Errand completed! Outcome summary:\n\n${activeTask.results?.summary}`,
            timestamp: Date.now(),
            taskSnapshot: activeTask,
          },
        ];
      });
    } else if (activeTask && (activeTask.status === 'failed' || activeTask.status === 'cancelled')) {
      const errMsg = activeTask.error_message || activeTask.current_step_description || 'Execution stopped.';
      setMessages((prev) => {
        const alreadyAdded = prev.some((m) => m.id === `task-end-${activeTask.id}`);
        if (alreadyAdded) return prev;
        return [
          ...prev,
          {
            id: `task-end-${activeTask.id}`,
            sender: 'lumina',
            text: activeTask.status === 'cancelled'
              ? `🛑 Errand cancelled: ${errMsg}`
              : `⚠️ Errand encountered an issue: ${errMsg}`,
            timestamp: Date.now(),
            taskSnapshot: activeTask,
          },
        ];
      });
    }
  }, [activeTask?.status, activeTask?.results?.summary, activeTask?.error_message]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, activeTask?.current_step_description]);

  const suggestions = [
    {
      emoji: '💻',
      label: 'Compare Laptops under $1,000',
      query: 'Research the best laptops under $1,000 and compare their specifications.',
    },
    {
      emoji: '💼',
      label: 'Apply for AI Engineer Job',
      query: 'Apply for the AI Engineer job opening using my profile.',
    },
    {
      emoji: '📅',
      label: 'Book Service Appointment',
      query: 'Find an appointment, compare available options, and prepare the booking for my approval.',
    },
    {
      emoji: '📑',
      label: 'Synthesize Page & Extract Data',
      query: 'Explore the current page, extract key facts and structured data, and generate a summary.',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) return;

    // Add user message to conversational thread
    const userPrompt = instruction.trim();
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: userPrompt,
        timestamp: Date.now(),
      },
    ]);

    onStartTask(userPrompt, mode);
    setInstruction('');
  };

  const handleCopySummary = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const isRunning = activeTask?.status === 'running' || activeTask?.status === 'planning';
  const isPaused = activeTask?.status === 'paused';
  const isWaitingApproval = activeTask?.status === 'waiting_for_approval';
  const isCompleted = activeTask?.status === 'completed';

  // Mascot Mood
  let mascotMood: MascotMood = 'idle';
  if (activeTask?.status === 'planning') mascotMood = 'thinking';
  else if (activeTask?.status === 'running') mascotMood = 'browsing';
  else if (activeTask?.status === 'waiting_for_approval') mascotMood = 'waiting_for_approval';
  else if (activeTask?.status === 'completed') mascotMood = 'completed';
  else if (activeTask?.status === 'paused') mascotMood = 'paused';
  else if (activeTask?.status === 'failed' || activeTask?.status === 'cancelled') mascotMood = 'failed';

  const completedStepsCount = activeTask
    ? activeTask.plan?.filter((_, idx) => idx < activeTask.step_index).length || 0
    : 0;
  const totalStepsCount = activeTask?.plan?.length || 0;
  const progressPercent = totalStepsCount > 0
    ? Math.min(100, Math.round(((activeTask?.step_index || 0) / totalStepsCount) * 100))
    : 0;

  return (
    <aside className={`muse-sidebar ${isOpen ? '' : 'collapsed'}`}>
      {/* 1. Header with Mascot & Lumina SI Branding */}
      <div className="muse-sidebar-header">
        <div className="muse-header-branding">
          <Mascot mood={mascotMood} size={30} showHalo={isRunning || isWaitingApproval} />
          <div className="muse-header-text">
            <div className="muse-brand-row">
              <span className="muse-name">Lumina SI</span>
              <span className="muse-agent-tag">Personal Agent</span>
            </div>
            <span className="muse-subtitle">
              {isRunning
                ? 'Autonomous Browser Active'
                : isWaitingApproval
                ? 'Approval Required'
                : 'Ready for instructions'}
            </span>
          </div>
        </div>

        <button className="muse-close-btn" onClick={onClose} title="Hide Lumina SI Panel">
          <X size={16} />
        </button>
      </div>

      {/* 2. Three-Tier Progressive Disclosure Navigation Tabs */}
      <div className="muse-tiers-bar">
        <button
          className={`muse-tier-btn ${activeTier === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTier('chat')}
        >
          <MessageSquare size={13} />
          <span>Chat & Errand</span>
        </button>

        <button
          className={`muse-tier-btn ${activeTier === 'plan' ? 'active' : ''}`}
          onClick={() => setActiveTier('plan')}
        >
          <ListTodo size={13} />
          <span>Action Plan</span>
          {totalStepsCount > 0 && (
            <span className="muse-counter-chip">{completedStepsCount}/{totalStepsCount}</span>
          )}
        </button>

        <button
          className={`muse-tier-btn ${activeTier === 'inspect' ? 'active' : ''}`}
          onClick={() => setActiveTier('inspect')}
        >
          <Code2 size={13} />
          <span>Raw Trail</span>
        </button>
      </div>

      {/* 3. Main Progressive Disclosure Content Body */}
      <div className="muse-content-body">
        {/* ===================== TIER 1: SURFACE / CHAT ===================== */}
        {activeTier === 'chat' && (
          <div className="muse-chat-pane">
            <div className="muse-messages-container" ref={chatScrollRef}>
              {messages.map((m) => (
                <div key={m.id} className={`muse-bubble-wrapper ${m.sender}`}>
                  {m.sender === 'lumina' && (
                    <div className="muse-bubble-avatar">
                      <Mascot mood={mascotMood} size={22} showHalo={false} />
                    </div>
                  )}

                  <div className={`muse-bubble ${m.sender}`}>
                    <div className="muse-bubble-text">{m.text}</div>

                    {/* If this message has a verified outcome summary */}
                    {m.taskSnapshot?.results?.summary && (
                      <div className="muse-outcome-card">
                        <div className="muse-outcome-header">
                          <CheckCircle size={14} color="#059669" />
                          <span>Verified Result</span>
                          <button
                            className="muse-copy-btn"
                            onClick={() => handleCopySummary(m.taskSnapshot?.results?.summary || '')}
                            title="Copy outcome"
                          >
                            {copiedSummary ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="muse-outcome-body">
                          {m.taskSnapshot.results.summary}
                        </div>
                      </div>
                    )}

                    <span className="muse-bubble-time">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {/* Live Step Progress Card if running */}
              {isRunning && (
                <div className="muse-live-activity-card">
                  <div className="muse-live-activity-header">
                    <div className="muse-live-pulsing-badge">
                      <span className="pulse-dot" />
                      <span>{activeTask?.status === 'planning' ? 'Planning Workflow' : 'Executing in Secure VM'}</span>
                    </div>
                    <span className="muse-step-status">
                      Step {(activeTask?.step_index || 0) + 1} of {totalStepsCount || 1}
                    </span>
                  </div>

                  <div className="muse-live-step-desc">
                    {activeTask?.current_step_description || 'Analyzing web page state...'}
                  </div>

                  {totalStepsCount > 0 && (
                    <div className="muse-progress-track">
                      <div
                        className="muse-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  <div className="muse-live-actions-row">
                    <button
                      className="muse-ctrl-btn secondary"
                      onClick={() => activeTask && onPauseTask(activeTask.id)}
                    >
                      <Pause size={12} /> Pause
                    </button>
                    <button
                      className="muse-ctrl-btn danger"
                      onClick={() => activeTask && onCancelTask(activeTask.id)}
                    >
                      <Square size={12} /> Stop
                    </button>
                    <button
                      className="muse-ctrl-btn ghost"
                      onClick={() => setActiveTier('plan')}
                    >
                      View Plan <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* Waiting For Approval Card */}
              {isWaitingApproval && (
                <div className="muse-approval-alert-card">
                  <div className="muse-approval-alert-header">
                    <ShieldAlert size={16} color="#d97706" />
                    <span>Consequential Action Gate</span>
                  </div>
                  <div className="muse-approval-alert-body">
                    Lumina SI has paused before taking an irreversible action. Please review and authorize in the confirmation dialog.
                  </div>
                </div>
              )}
            </div>

            {/* Quick Suggestion Chips */}
            <div className="muse-suggestions-drawer">
              <span className="muse-suggestions-label">RECOMMENDED ERRANDS</span>
              <div className="muse-chips-grid">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="muse-action-chip"
                    onClick={() => {
                      setInstruction(s.query);
                    }}
                  >
                    <span className="chip-emoji">{s.emoji}</span>
                    <span className="chip-text">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Composer */}
            <form className="muse-composer-card" onSubmit={handleSubmit}>
              <div className="muse-composer-options">
                <span className="muse-mode-label">Mode:</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="muse-mode-select"
                >
                  <option value="autonomous">⚡ Autonomous</option>
                  <option value="research">📚 Deep Research</option>
                  <option value="workflow">📋 Form Fill & Workflow</option>
                </select>
              </div>

              <div className="muse-input-wrapper">
                <textarea
                  className="muse-prompt-input"
                  placeholder="Ask Lumina SI to browse, compare, or take action..."
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  disabled={isRunning}
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />

                <button
                  type="submit"
                  className="muse-send-btn"
                  disabled={isRunning || !instruction.trim()}
                  title="Send to Lumina SI"
                >
                  <Send size={15} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================== TIER 2: MANAGEMENT / ACTION PLAN ===================== */}
        {activeTier === 'plan' && (
          <div className="muse-plan-pane">
            <div className="muse-plan-header">
              <div className="muse-plan-title-block">
                <h4>Action Plan & Verification</h4>
                <p>Structured breakdown of autonomous browser operations</p>
              </div>

              {activeTask && (
                <div className="muse-task-controls">
                  {isRunning && (
                    <button
                      className="muse-pill-btn pause"
                      onClick={() => onPauseTask(activeTask.id)}
                    >
                      <Pause size={12} /> Pause
                    </button>
                  )}
                  {isPaused && (
                    <button
                      className="muse-pill-btn resume"
                      onClick={() => onResumeTask(activeTask.id)}
                    >
                      <Play size={12} /> Resume
                    </button>
                  )}
                  {(isRunning || isPaused) && (
                    <button
                      className="muse-pill-btn stop"
                      onClick={() => onCancelTask(activeTask.id)}
                    >
                      <Square size={12} /> Stop
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Overall Progress Meter */}
            {totalStepsCount > 0 && (
              <div className="muse-plan-progress-box">
                <div className="muse-progress-labels">
                  <span>Execution Progress</span>
                  <span>{progressPercent}% ({completedStepsCount} of {totalStepsCount} steps)</span>
                </div>
                <div className="muse-progress-bar">
                  <div className="muse-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}

            {/* Checklist of Steps */}
            {activeTask?.plan && activeTask.plan.length > 0 ? (
              <div className="muse-steps-timeline">
                {activeTask.plan.map((step, idx) => {
                  const isDone = idx < (activeTask.step_index || 0);
                  const isCurrent = idx === activeTask.step_index && isRunning;
                  const isWaiting = idx === activeTask.step_index && isWaitingApproval;

                  return (
                    <div
                      key={idx}
                      className={`muse-step-card ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isWaiting ? 'waiting' : ''}`}
                    >
                      <div className="muse-step-badge">
                        {isDone ? (
                          <CheckCircle size={16} color="#059669" />
                        ) : isCurrent ? (
                          <div className="muse-step-current-dot" />
                        ) : isWaiting ? (
                          <ShieldAlert size={16} color="#d97706" />
                        ) : (
                          <span className="muse-step-number">{idx + 1}</span>
                        )}
                      </div>

                      <div className="muse-step-info">
                        <div className="muse-step-tool-row">
                          <span className="muse-tool-tag">{step.tool_name}</span>
                          {step.verification_check && (
                            <span className="muse-verify-tag">
                              ✓ {step.verification_check}
                            </span>
                          )}
                        </div>
                        <div className="muse-step-desc-text">{step.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="muse-empty-plan">
                <ListTodo size={32} color="#94a3b8" />
                <p>No active action plan</p>
                <span>Instruct Lumina SI to begin a multi-step task, and the verified execution plan will appear here.</span>
              </div>
            )}

            {/* Playwright Browser Snapshot Thumbnail */}
            {activeTask?.latest_screenshot && (
              <div className="muse-snapshot-container">
                <div className="muse-snapshot-header">
                  <span className="muse-snapshot-title">LATEST BROWSER SNAPSHOT</span>
                  <button
                    className="muse-snapshot-expand-btn"
                    onClick={() => setShowScreenshotModal(true)}
                  >
                    <Eye size={12} /> Inspect
                  </button>
                </div>
                <img
                  src={`data:image/png;base64,${activeTask.latest_screenshot}`}
                  alt="Browser Viewport"
                  className="muse-snapshot-img"
                  onClick={() => setShowScreenshotModal(true)}
                />
              </div>
            )}

            {/* Verified Outcome Card */}
            {activeTask?.results?.summary && (
              <div className="muse-final-outcome-box">
                <div className="muse-outcome-title">
                  <CheckCircle size={15} color="#059669" />
                  <span>Verified Outcome Summary</span>
                </div>
                <div className="muse-outcome-content">
                  {activeTask.results.summary}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TIER 3: POWER USER / RAW TRAIL ===================== */}
        {activeTier === 'inspect' && (
          <div className="muse-inspect-pane">
            <div className="muse-inspect-header">
              <h4>Raw Execution Trail</h4>
              <p>Granular tool execution parameters, DOM inspection, and safety boundaries</p>
            </div>

            {/* Safety Classification Overview */}
            <div className="muse-security-verdict-box">
              <span className="sec-label">SECURITY & BOUNDARY STATUS</span>
              <div className="sec-badges-row">
                <span className="sec-badge cat-a">Category A: Routine (Auto)</span>
                <span className="sec-badge cat-b">Category B: Sensitive (Supervised)</span>
                <span className="sec-badge cat-c">Category C: Consequential (Gated)</span>
              </div>
            </div>

            {/* Tool Executions Trail */}
            {activeTask?.executed_steps && activeTask.executed_steps.length > 0 ? (
              <div className="muse-raw-logs-list">
                {activeTask.executed_steps.map((log, idx) => (
                  <div key={idx} className="muse-log-entry">
                    <div className="muse-log-top">
                      <span className="muse-log-step-num">Step {log.step}</span>
                      <span className="muse-log-tool-name">{log.tool}</span>
                      <span className={`muse-log-status ${log.success ? 'success' : 'failed'}`}>
                        {log.success ? 'SUCCESS' : 'FAILED'}
                      </span>
                    </div>

                    <div className="muse-log-desc">{log.description}</div>

                    {log.params && Object.keys(log.params).length > 0 && (
                      <div className="muse-log-code-block">
                        <span className="code-label">Parameters:</span>
                        <pre>{JSON.stringify(log.params, null, 2)}</pre>
                      </div>
                    )}

                    {log.output && (
                      <div className="muse-log-code-block">
                        <span className="code-label">DOM Output / Result:</span>
                        <pre>
                          {typeof log.output === 'string'
                            ? log.output
                            : JSON.stringify(log.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muse-empty-logs">
                <Code2 size={28} color="#94a3b8" />
                <p>No execution logs yet</p>
                <span>Granular trace data will populate here as tools execute.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Snapshot Modal */}
      {showScreenshotModal && activeTask?.latest_screenshot && (
        <div className="modal-overlay" onClick={() => setShowScreenshotModal(false)}>
          <div className="modal-card" style={{ maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Lumina SI Secure VM — Browser Snapshot</h3>
              <button className="tool-btn" onClick={() => setShowScreenshotModal(false)}>
                <X size={16} />
              </button>
            </div>
            <img
              src={`data:image/png;base64,${activeTask.latest_screenshot}`}
              alt="Full Snapshot"
              style={{ width: '100%', borderRadius: 8, marginTop: 12 }}
            />
          </div>
        </div>
      )}
    </aside>
  );
};
