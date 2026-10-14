"""
Lumina AI Browser - FastAPI Backend Service
Provides REST API endpoints for desktop UI communication, Playwright orchestration,
autonomous task execution, approvals, bookmarks, history, and test sites.
"""

from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional
import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from agent.browser.manager import browser_manager
from agent.memory.db import db
from agent.planner.engine import task_engine
from agent.permissions.policy import SafetyPolicy


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and browser manager
    await db.init_db()
    await browser_manager.initialize()
    yield
    # Shutdown: clean up browser context
    await browser_manager.close()


app = FastAPI(title="Lumina AI Browser Backend", lifespan=lifespan)

# Allow CORS for local Electron and Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request schemas
class NavigateRequest(BaseModel):
    url: str


class TaskCreateRequest(BaseModel):
    instruction: str
    mode: str = "autonomous"
    target_url: Optional[str] = None


class ApprovalDecisionRequest(BaseModel):
    approved: bool
    reason: Optional[str] = ""


class BookmarkRequest(BaseModel):
    url: str
    title: str


# 1. Health Endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "Lumina AI Browser", "version": "1.0.0"}


# 2. Browser Navigation & Tabs Endpoints
@app.get("/api/browser/tabs")
async def get_tabs():
    tabs = await browser_manager.list_tabs()
    return {"tabs": tabs, "active_tab_id": browser_manager.active_tab_id}


@app.post("/api/browser/tabs")
async def create_tab(req: Optional[NavigateRequest] = None):
    url = req.url if req else "about:blank"
    tab = await browser_manager.create_tab(url=url)
    return tab


@app.post("/api/browser/tabs/{tab_id}/switch")
async def switch_tab(tab_id: str):
    ok = await browser_manager.switch_tab(tab_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Tab not found")
    return {"success": True, "active_tab_id": tab_id}


@app.delete("/api/browser/tabs/{tab_id}")
async def close_tab(tab_id: str):
    ok = await browser_manager.close_tab(tab_id)
    return {"success": ok}


@app.post("/api/browser/navigate")
async def navigate_browser(req: NavigateRequest):
    allowed, reason = SafetyPolicy.is_url_allowed(req.url)
    if not allowed:
        raise HTTPException(status_code=400, detail=f"Safety policy rejected URL: {reason}")
    res = await browser_manager.navigate(req.url)
    await db.add_history(res["url"], res["title"])
    return res


@app.post("/api/browser/back")
async def go_back():
    return await browser_manager.go_back()


@app.post("/api/browser/forward")
async def go_forward():
    return await browser_manager.go_forward()


@app.post("/api/browser/reload")
async def reload_page():
    return await browser_manager.reload()


@app.get("/api/browser/screenshot")
async def get_screenshot():
    b64, path = await browser_manager.take_screenshot(save_to_disk=False)
    return {"screenshot_b64": b64}


@app.get("/api/browser/dom")
async def inspect_page_dom():
    return await browser_manager.inspect_dom()


# 3. Tasks & Agent Endpoints
@app.post("/api/tasks")
async def create_task(req: TaskCreateRequest):
    task_id = await task_engine.start_task(
        instruction=req.instruction,
        mode=req.mode,
        target_url=req.target_url
    )
    return {"task_id": task_id, "status": "pending"}


@app.get("/api/tasks")
async def list_tasks():
    return await db.list_tasks(limit=30)


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    task = await task_engine.get_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/tasks/{task_id}/pause")
async def pause_task(task_id: str):
    ok = await task_engine.pause_task(task_id)
    return {"success": ok}


@app.post("/api/tasks/{task_id}/resume")
async def resume_task(task_id: str):
    ok = await task_engine.resume_task(task_id)
    return {"success": ok}


@app.post("/api/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    ok = await task_engine.cancel_task(task_id)
    return {"success": ok}


# 4. Approvals Endpoints
@app.get("/api/approvals/pending")
async def get_pending_approvals():
    return await db.get_pending_approvals()


@app.post("/api/approvals/{approval_id}/decide")
async def decide_approval(approval_id: str, req: ApprovalDecisionRequest):
    ok = await task_engine.decide_approval(approval_id, req.approved, req.reason or "")
    if not ok:
        raise HTTPException(status_code=404, detail="Approval not found")
    return {"success": True, "approval_id": approval_id, "approved": req.approved}


# 5. History & Bookmarks Endpoints
@app.get("/api/history")
async def get_history():
    return await db.get_history(limit=100)


@app.delete("/api/history")
async def clear_history():
    await db.clear_history()
    return {"success": True}


@app.get("/api/bookmarks")
async def get_bookmarks():
    return await db.get_bookmarks()


@app.post("/api/bookmarks")
async def add_bookmark(req: BookmarkRequest):
    await db.add_bookmark(req.url, req.title)
    return {"success": True}


@app.delete("/api/bookmarks")
async def remove_bookmark(url: str):
    await db.remove_bookmark(url)
    return {"success": True}


# 6. User Profile & Settings Endpoints
@app.get("/api/profile")
async def get_profile():
    return await db.get_profile()


@app.post("/api/profile")
async def update_profile(profile_data: Dict[str, Any]):
    await db.save_profile(profile_data)
    return {"success": True}


@app.get("/api/settings")
async def get_settings():
    return await db.get_all_settings()


@app.post("/api/settings")
async def update_settings(settings: Dict[str, Any]):
    for k, v in settings.items():
        await db.save_setting(k, v)
    return {"success": True}


# 7. Built-in Local Test Site for Deterministic Verification
@app.get("/test-site/laptops", response_class=HTMLResponse)
async def test_site_laptops():
    return """<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>TechVault - Laptops Catalog</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
            .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .price { font-size: 20px; font-weight: bold; color: #2563eb; margin: 8px 0; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #15803d; }
            .specs { font-size: 13px; color: #64748b; line-height: 1.6; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Laptops Catalog (Under $1,000 Comparison)</h1>
            <p>Showing curated laptops with verified hardware specifications.</p>
        </div>
        <div class="grid">
            <div class="card" id="laptop-1">
                <span class="badge">Under $1,000</span>
                <h3>SwiftBook Air M2</h3>
                <div class="price">$899</div>
                <div class="specs">
                    <div><strong>RAM:</strong> 16GB Unified</div>
                    <div><strong>Storage:</strong> 512GB SSD</div>
                    <div><strong>Display:</strong> 13.6-inch Liquid Retina</div>
                    <div><strong>Battery:</strong> Up to 18 hours</div>
                </div>
            </div>
            <div class="card" id="laptop-2">
                <span class="badge">Under $1,000</span>
                <h3>Zenith Pro 14</h3>
                <div class="price">$949</div>
                <div class="specs">
                    <div><strong>Processor:</strong> AMD Ryzen 7 7730U</div>
                    <div><strong>RAM:</strong> 16GB LPDDR5</div>
                    <div><strong>Storage:</strong> 1TB PCIe NVMe SSD</div>
                    <div><strong>Display:</strong> 14.0-inch 2.8K 90Hz OLED</div>
                </div>
            </div>
            <div class="card" id="laptop-3">
                <span class="badge">Under $1,000</span>
                <h3>AeroGlide Slim</h3>
                <div class="price">$799</div>
                <div class="specs">
                    <div><strong>Processor:</strong> Intel Core Ultra 5</div>
                    <div><strong>RAM:</strong> 16GB RAM</div>
                    <div><strong>Storage:</strong> 512GB SSD</div>
                    <div><strong>Display:</strong> 14-inch IPS 100% sRGB</div>
                </div>
            </div>
            <div class="card" id="laptop-4">
                <span class="badge" style="background:#fee2e2;color:#b91c1c;">Over $1,000</span>
                <h3>Titan Studio Pro</h3>
                <div class="price">$1,499</div>
                <div class="specs">
                    <div><strong>Processor:</strong> Intel Core i9</div>
                    <div><strong>GPU:</strong> RTX 4070</div>
                    <div><strong>RAM:</strong> 32GB DDR5</div>
                </div>
            </div>
        </div>
    </body>
    </html>"""


@app.get("/test-site/jobs", response_class=HTMLResponse)
async def test_site_jobs():
    return """<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Careers Portal - AI Agent Engineer</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
            .container { max-width: 640px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; }
            .form-group { margin-bottom: 16px; }
            label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 6px; }
            input, textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
            button { background: #2563eb; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%; }
            button:hover { background: #1d4ed8; }
            #submitted-msg { display: none; background: #dcfce7; color: #166534; padding: 16px; border-radius: 8px; margin-top: 16px; font-weight: 600; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Senior AI Agent Engineer</h1>
            <p><strong>Requirements:</strong> Python, TypeScript, Playwright, LLM Orchestration, System Safety.</p>
            <hr style="border:0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <form id="apply-form" onsubmit="event.preventDefault(); document.getElementById('submitted-msg').style.display = 'block';">
                <div class="form-group">
                    <label for="name">Full Name</label>
                    <input type="text" id="name" name="name" placeholder="Your full name" required>
                </div>
                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input type="email" id="email" name="email" placeholder="you@domain.com" required>
                </div>
                <div class="form-group">
                    <label for="phone">Phone Number</label>
                    <input type="tel" id="phone" name="phone" placeholder="+1 (555) 000-0000">
                </div>
                <div class="form-group">
                    <label for="linkedin">LinkedIn Profile URL</label>
                    <input type="url" id="linkedin" name="linkedin" placeholder="https://linkedin.com/in/username">
                </div>
                <button type="submit" id="apply-submit-btn">Submit Application</button>
            </form>
            <div id="submitted-msg">Application submitted successfully! Our talent team will review your qualifications.</div>
        </div>
    </body>
    </html>"""


@app.get("/test-site/booking", response_class=HTMLResponse)
async def test_site_booking():
    return """<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>QuickBook - Appointment Schedule</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
            .container { max-width: 580px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; }
            .slots { display: flex; gap: 10px; margin: 16px 0; }
            .time-slot-btn { padding: 10px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 8px; cursor: pointer; }
            .time-slot-btn.selected { background: #2563eb; color: white; border-color: #2563eb; }
            input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 12px; }
            #confirm-booking-btn { background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; width: 100%; cursor: pointer; }
            #booked-alert { display: none; background: #d1fae5; color: #065f46; padding: 14px; border-radius: 8px; margin-top: 14px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Schedule Consultation</h2>
            <p>Select an available consultation window:</p>
            <div class="slots">
                <button type="button" class="time-slot-btn" onclick="this.classList.toggle('selected')">10:00 AM</button>
                <button type="button" class="time-slot-btn" onclick="this.classList.toggle('selected')">02:30 PM</button>
                <button type="button" class="time-slot-btn" onclick="this.classList.toggle('selected')">04:00 PM</button>
            </div>
            <input type="text" id="client-name" name="name" placeholder="Client Name">
            <input type="email" id="client-email" name="email" placeholder="Client Email">
            <button type="button" id="confirm-booking-btn" onclick="document.getElementById('booked-alert').style.display = 'block';">Confirm Booking</button>
            <div id="booked-alert">Appointment confirmed! Calendar invite dispatched.</div>
        </div>
    </body>
    </html>"""


if __name__ == "__main__":
    uvicorn.run("agent.api.main:app", host="127.0.0.1", port=8765, reload=False)
