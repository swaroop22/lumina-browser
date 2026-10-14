/**
 * Lumina AI Browser - Frontend API Client
 * Connects React UI to FastAPI Python agent backend on http://127.0.0.1:8765
 */

const API_BASE = 'http://127.0.0.1:8765/api';

export interface TabItem {
  id: string;
  title: string;
  url: string;
  is_active: boolean;
  created_at: number;
}

export interface TaskRecord {
  id: string;
  instruction: string;
  mode: string;
  status: 'pending' | 'planning' | 'running' | 'paused' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled';
  step_index: number;
  max_steps: number;
  current_step_description: string;
  plan: Array<{
    step_number: number;
    tool_name: string;
    description: string;
    parameters: Record<string, any>;
    verification_check: string;
  }>;
  executed_steps: Array<{
    step: number;
    tool: string;
    description: string;
    params: Record<string, any>;
    success: boolean;
    output: any;
    error?: string;
    timestamp: number;
  }>;
  results?: {
    summary?: string;
    total_steps?: number;
    sources?: string[];
    artifacts?: any[];
  };
  latest_screenshot?: string;
  current_approval_id?: string;
  error_message?: string;
  created_at: number;
  updated_at: number;
}

export interface ApprovalItem {
  id: string;
  task_id: string;
  category: 'CATEGORY_A' | 'CATEGORY_B' | 'CATEGORY_C';
  action_name: string;
  description: string;
  parameters: Record<string, any>;
  risk_summary: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: number;
}

export interface UserProfile {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  linkedin_url: string;
  github_url: string;
  resume_text: string;
  skills: string[];
}

export interface HistoryItem {
  id: number;
  url: string;
  title: string;
  visit_time: number;
}

export interface BookmarkItem {
  id: number;
  url: string;
  title: string;
  created_at: number;
}

// API methods
export async function fetchTabs(): Promise<{ tabs: TabItem[]; active_tab_id: string }> {
  const res = await fetch(`${API_BASE}/browser/tabs`);
  return res.json();
}

export async function createTab(url: string = 'about:blank'): Promise<TabItem> {
  const res = await fetch(`${API_BASE}/browser/tabs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function switchTab(tabId: string): Promise<void> {
  await fetch(`${API_BASE}/browser/tabs/${tabId}/switch`, { method: 'POST' });
}

export async function closeTab(tabId: string): Promise<void> {
  await fetch(`${API_BASE}/browser/tabs/${tabId}`, { method: 'DELETE' });
}

export async function navigateBrowser(url: string): Promise<any> {
  const res = await fetch(`${API_BASE}/browser/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Navigation failed');
  }
  return res.json();
}

export async function goBack(): Promise<any> {
  const res = await fetch(`${API_BASE}/browser/back`, { method: 'POST' });
  return res.json();
}

export async function goForward(): Promise<any> {
  const res = await fetch(`${API_BASE}/browser/forward`, { method: 'POST' });
  return res.json();
}

export async function reloadBrowser(): Promise<any> {
  const res = await fetch(`${API_BASE}/browser/reload`, { method: 'POST' });
  return res.json();
}

export async function getScreenshot(): Promise<{ screenshot_b64: string }> {
  const res = await fetch(`${API_BASE}/browser/screenshot`);
  return res.json();
}

export async function startTask(instruction: string, mode: string = 'autonomous', targetUrl?: string): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction, mode, target_url: targetUrl }),
  });
  return res.json();
}

export async function getTask(taskId: string): Promise<TaskRecord> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`);
  return res.json();
}

export async function listTasks(): Promise<TaskRecord[]> {
  const res = await fetch(`${API_BASE}/tasks`);
  return res.json();
}

export async function pauseTask(taskId: string): Promise<void> {
  await fetch(`${API_BASE}/tasks/${taskId}/pause`, { method: 'POST' });
}

export async function resumeTask(taskId: string): Promise<void> {
  await fetch(`${API_BASE}/tasks/${taskId}/resume`, { method: 'POST' });
}

export async function cancelTask(taskId: string): Promise<void> {
  await fetch(`${API_BASE}/tasks/${taskId}/cancel`, { method: 'POST' });
}

export async function getPendingApprovals(): Promise<ApprovalItem[]> {
  const res = await fetch(`${API_BASE}/approvals/pending`);
  return res.json();
}

export async function decideApproval(approvalId: string, approved: boolean, reason: string = ''): Promise<void> {
  await fetch(`${API_BASE}/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved, reason }),
  });
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetch(`${API_BASE}/history`);
  return res.json();
}

export async function clearHistory(): Promise<void> {
  await fetch(`${API_BASE}/history`, { method: 'DELETE' });
}

export async function fetchBookmarks(): Promise<BookmarkItem[]> {
  const res = await fetch(`${API_BASE}/bookmarks`);
  return res.json();
}

export async function addBookmark(url: string, title: string): Promise<void> {
  await fetch(`${API_BASE}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title }),
  });
}

export async function removeBookmark(url: string): Promise<void> {
  await fetch(`${API_BASE}/bookmarks?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/profile`);
  return res.json();
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await fetch(`${API_BASE}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
}

export async function fetchSettings(): Promise<Record<string, any>> {
  const res = await fetch(`${API_BASE}/settings`);
  return res.json();
}

export async function saveSettings(settings: Record<string, any>): Promise<void> {
  await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}
