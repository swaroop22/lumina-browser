# Lumina AI Browser 🌐✨
### Autonomous Cognitive Desktop Web Browser (Muse-Style)

Lumina AI Browser is a desktop web browser engineered with autonomous AI capabilities inspired by cognitive browsers like Muse. It seamlessly blends standard browsing with an autonomous agent engine capable of understanding natural-language instructions, executing multi-step workflows, inspecting page states, recovering from errors, and strictly respecting human approval boundaries.

---

## 🌟 Muse-Inspired Cognitive Browser Features

1. **Persistent Top Status Pill & Animated Mascot (Alex Cornell Design Signature)**
   - Anchored persistently at the top center of the desktop chrome.
   - Dynamic animated SVG mascot displaying expressive agent states:
     - ☕ *Idle* · ⚡ *Thinking* · 🌐 *Browsing* · ⌨️ *Typing on tiny laptop* · 🛡️ *Awaiting Approval* · ✨ *Completed*.
     - Live human-first status pill with pulsing indicator and quick oversight actions.

2. **Three-Tier Progressive Disclosure Architecture**
   - **Tier 1 (Surface / Conversational Thread):** Natural conversational chat interface with Muse, friendly cards, verified summaries with copy action, and quick errand suggestions.
   - **Tier 2 (Management / Action Plan):** Structured step-by-step checklist with tool tags, verification chips (`Verifying: DOM contains comparison table`), progress bar, and Playwright screenshot inspector.
   - **Tier 3 (Power User / Raw Trail):** Granular tool execution timeline, DOM inspection nodes, JSON parameters, and security classification status.

3. **Muse Secure VM Viewport & Live Overseer Supervision**
   - Sandboxed Chromium browser session with security badges and credential vault protection.
   - Floating supervision bar with live status:
     - `[⏸️ Take Control]`: User instantly pauses Muse and takes direct interactive mouse/keyboard control.
     - `[▶️ Hand Back to Muse]`: Hands session back to Muse to resume autonomous execution.
     - `[🛑 Stop Task]`: Instant emergency halt.

4. **Category C Consequential Action Gate**
   - Pauses execution before irreversible actions (submitting applications, making purchases, booking).
   - Elevated security review card with parameters preview and explicit `[Authorize & Proceed]` vs `[Reject & Halt]` choices.

5. **Cosmic Dark & Airy Light Design System**
   - Deep obsidian glassmorphic dark mode (`#090d16`) with violet/iris neon accents and frosted glass headers.
   - One-click toggle to crisp, warm airy light mode.
   - Integrated Omnibar with direct `Ask Muse` action chips, bookmarks quick strip, and split/focus view modes.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│             Lumina Electron Desktop Shell              │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │   Navigation Toolbar  │  │   Tab Bar Manager     │  │
│  └───────────────────────┘  └───────────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │  Interactive Browser  │  │   Lumina AI Sidebar   │  │
│  │       Viewport        │  │ • Step Checklist      │  │
│  │ (Real Chromium Pages) │  │ • Stop / Pause / Run  │  │
│  └───────────────────────┘  └───────────────────────┘  │
└────────────────────────────┬───────────────────────────┘
                             │ REST / WebSocket (localhost:8765)
┌────────────────────────────▼───────────────────────────┐
│              FastAPI Agent Backend (Python)            │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Autonomous Planner (Plan-Observe-Act-Verify)   │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                            │
│  ┌───────────────────────▼┐  ┌──────────────────────┐  │
│  │ Safety & Permissions   │  │  LLM Provider Engine │  │
│  │ • Category A/B/C Gate  │  │  • Built-in Offline  │  │
│  │ • SSRF & Injection     │  │  • OpenAI / Gemini   │  │
│  └────────────────────────┘  └──────────────────────┘  │
│                           │                            │
│  ┌───────────────────────▼┐  ┌──────────────────────┐  │
│  │  Playwright Automation │  │ SQLite Persistence   │  │
│  │  • Persistent Session  │  │ • Checkpoints & Tasks│  │
│  │  • Multi-Tab DOM & CSS │  │ • User Profile & Mem │  │
│  └────────────────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.12+ (or Conda `py312` environment)

### 1. Install Dependencies
```bash
# Frontend & Electron
npm install

# Build UI and Electron
npm run build
```

### 2. Run Automated Verification Tests
All 8 automated tests verify browser navigation, tab orchestration, DOM parsing, safety policies, SSRF blocking, form filling, and Category C human approval gating:
```bash
./scripts/run_tests.sh
```

### 3. Launch the Application
Start the backend service and desktop application:
```bash
./scripts/start_desktop.sh
```

Or run them individually:
```bash
# Terminal 1: Start FastAPI backend
./scripts/start_backend.sh

# Terminal 2: Start Electron desktop app
npm run start
```

---

## 🧪 Demonstration Tasks

Open Lumina and try these instructions:
1. **Laptops Specification Research:**
   > *"Research the best laptops under $1,000 and compare their specifications."*
   - Navigates to catalog, inspects specs, scrolls listings, and exports a Markdown report.

2. **Job Application Preparation & Submission:**
   > *"Apply for the AI Engineer job opening using my profile."*
   - Navigates to jobs portal, fills candidate fields from profile, hits the Category C approval gateway, requests explicit user confirmation, and submits only upon authorization.

3. **Appointment Scheduling:**
   > *"Find an appointment, compare available options, and prepare the booking for my approval."*
   - Selects available time slots, fills contact information, and halts for user confirmation.
