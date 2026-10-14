"""
Lumina AI Browser - SQLite Persistence Layer
Handles tasks, execution checkpoints, approvals, user memory, browser history, bookmarks, and user profile.
"""

import aiosqlite
import json
import os
import time
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "lumina_browser.db"
)


class Database:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    instruction TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    status TEXT NOT NULL,
                    plan_json TEXT,
                    step_index INTEGER DEFAULT 0,
                    results_json TEXT,
                    error_message TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS checkpoints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    step_index INTEGER NOT NULL,
                    url TEXT,
                    title TEXT,
                    screenshot_path TEXT,
                    dom_summary TEXT,
                    created_at REAL NOT NULL,
                    FOREIGN KEY(task_id) REFERENCES tasks(id)
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS approvals (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    category TEXT NOT NULL,
                    action_name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    params_json TEXT NOT NULL,
                    risk_summary TEXT NOT NULL,
                    status TEXT NOT NULL,
                    requested_at REAL NOT NULL,
                    decided_at REAL,
                    reason TEXT,
                    FOREIGN KEY(task_id) REFERENCES tasks(id)
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS browser_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    visit_time REAL NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS bookmarks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS user_memory (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    category TEXT NOT NULL,
                    user_approved INTEGER DEFAULT 1,
                    created_at REAL NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS user_profile (
                    id TEXT PRIMARY KEY,
                    full_name TEXT DEFAULT '',
                    email TEXT DEFAULT '',
                    phone TEXT DEFAULT '',
                    address TEXT DEFAULT '',
                    linkedin_url TEXT DEFAULT '',
                    github_url TEXT DEFAULT '',
                    resume_text TEXT DEFAULT '',
                    skills_json TEXT DEFAULT '[]',
                    preferences_json TEXT DEFAULT '{}',
                    updated_at REAL NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            await db.commit()

    async def save_task(self, task_data: Dict[str, Any]):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO tasks (id, instruction, mode, status, plan_json, step_index, results_json, error_message, created_at, updated_at)
                VALUES (:id, :instruction, :mode, :status, :plan_json, :step_index, :results_json, :error_message, :created_at, :updated_at)
                ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status,
                    plan_json=excluded.plan_json,
                    step_index=excluded.step_index,
                    results_json=excluded.results_json,
                    error_message=excluded.error_message,
                    updated_at=excluded.updated_at
            """, {
                "id": task_data["id"],
                "instruction": task_data["instruction"],
                "mode": task_data.get("mode", "autonomous"),
                "status": task_data.get("status", "pending"),
                "plan_json": json.dumps(task_data.get("plan", [])),
                "step_index": task_data.get("step_index", 0),
                "results_json": json.dumps(task_data.get("results", {})),
                "error_message": task_data.get("error_message"),
                "created_at": task_data.get("created_at", time.time()),
                "updated_at": time.time(),
            })
            await db.commit()

    async def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            data = dict(row)
            data["plan"] = json.loads(data["plan_json"]) if data["plan_json"] else []
            data["results"] = json.loads(data["results_json"]) if data["results_json"] else {}
            return data

    async def list_tasks(self, limit: int = 50) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = await cursor.fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["plan"] = json.loads(d["plan_json"]) if d["plan_json"] else []
                d["results"] = json.loads(d["results_json"]) if d["results_json"] else {}
                out.append(d)
            return out

    async def save_checkpoint(self, task_id: str, step_index: int, url: str, title: str, screenshot_path: str = "", dom_summary: str = ""):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO checkpoints (task_id, step_index, url, title, screenshot_path, dom_summary, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (task_id, step_index, url, title, screenshot_path, dom_summary, time.time()))
            await db.commit()

    async def get_latest_checkpoint(self, task_id: str) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT * FROM checkpoints WHERE task_id = ? ORDER BY step_index DESC LIMIT 1
            """, (task_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def save_approval(self, approval_data: Dict[str, Any]):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO approvals (id, task_id, category, action_name, description, params_json, risk_summary, status, requested_at, decided_at, reason)
                VALUES (:id, :task_id, :category, :action_name, :description, :params_json, :risk_summary, :status, :requested_at, :decided_at, :reason)
                ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status,
                    decided_at=excluded.decided_at,
                    reason=excluded.reason
            """, {
                "id": approval_data["id"],
                "task_id": approval_data["task_id"],
                "category": approval_data["category"],
                "action_name": approval_data["action_name"],
                "description": approval_data["description"],
                "params_json": json.dumps(approval_data.get("parameters", {})),
                "risk_summary": approval_data.get("risk_summary", ""),
                "status": approval_data.get("status", "pending"),
                "requested_at": approval_data.get("requested_at", time.time()),
                "decided_at": approval_data.get("decided_at"),
                "reason": approval_data.get("reason"),
            })
            await db.commit()

    async def get_pending_approvals(self, task_id: Optional[str] = None) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            if task_id:
                cursor = await db.execute("SELECT * FROM approvals WHERE task_id = ? AND status = 'pending' ORDER BY requested_at ASC", (task_id,))
            else:
                cursor = await db.execute("SELECT * FROM approvals WHERE status = 'pending' ORDER BY requested_at ASC")
            rows = await cursor.fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["parameters"] = json.loads(d["params_json"]) if d["params_json"] else {}
                out.append(d)
            return out

    async def add_history(self, url: str, title: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO browser_history (url, title, visit_time) VALUES (?, ?, ?)
            """, (url, title, time.time()))
            await db.commit()

    async def get_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM browser_history ORDER BY visit_time DESC LIMIT ?", (limit,))
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def clear_history(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM browser_history")
            await db.commit()

    async def add_bookmark(self, url: str, title: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT OR REPLACE INTO bookmarks (url, title, created_at) VALUES (?, ?, ?)
            """, (url, title, time.time()))
            await db.commit()

    async def get_bookmarks(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM bookmarks ORDER BY created_at DESC")
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def remove_bookmark(self, url: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM bookmarks WHERE url = ?", (url,))
            await db.commit()

    async def save_profile(self, profile_data: Dict[str, Any]):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO user_profile (id, full_name, email, phone, address, linkedin_url, github_url, resume_text, skills_json, preferences_json, updated_at)
                VALUES ('default', :full_name, :email, :phone, :address, :linkedin_url, :github_url, :resume_text, :skills_json, :preferences_json, :updated_at)
                ON CONFLICT(id) DO UPDATE SET
                    full_name=excluded.full_name,
                    email=excluded.email,
                    phone=excluded.phone,
                    address=excluded.address,
                    linkedin_url=excluded.linkedin_url,
                    github_url=excluded.github_url,
                    resume_text=excluded.resume_text,
                    skills_json=excluded.skills_json,
                    preferences_json=excluded.preferences_json,
                    updated_at=excluded.updated_at
            """, {
                "full_name": profile_data.get("full_name", ""),
                "email": profile_data.get("email", ""),
                "phone": profile_data.get("phone", ""),
                "address": profile_data.get("address", ""),
                "linkedin_url": profile_data.get("linkedin_url", ""),
                "github_url": profile_data.get("github_url", ""),
                "resume_text": profile_data.get("resume_text", ""),
                "skills_json": json.dumps(profile_data.get("skills", [])),
                "preferences_json": json.dumps(profile_data.get("preferences", {})),
                "updated_at": time.time(),
            })
            await db.commit()

    async def get_profile(self) -> Dict[str, Any]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM user_profile WHERE id = 'default'")
            row = await cursor.fetchone()
            if not row:
                return {
                    "full_name": "",
                    "email": "",
                    "phone": "",
                    "address": "",
                    "linkedin_url": "",
                    "github_url": "",
                    "resume_text": "",
                    "skills": [],
                    "preferences": {}
                }
            d = dict(row)
            d["skills"] = json.loads(d["skills_json"]) if d["skills_json"] else []
            d["preferences"] = json.loads(d["preferences_json"]) if d["preferences_json"] else {}
            return d

    async def save_setting(self, key: str, value: Any):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
            """, (key, json.dumps(value)))
            await db.commit()

    async def get_setting(self, key: str, default: Any = None) -> Any:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = await cursor.fetchone()
            if row:
                return json.loads(row[0])
            return default

    async def get_all_settings(self) -> Dict[str, Any]:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT key, value FROM settings")
            rows = await cursor.fetchall()
            return {r[0]: json.loads(r[1]) for r in rows}


# Global singleton instance
db = Database()
