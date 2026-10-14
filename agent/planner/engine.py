"""
Lumina AI Browser - Autonomous Task Engine
Executes the PLAN -> OBSERVE -> ACT -> VERIFY -> REPLAN loop.
Provides checkpointing, error recovery, bounds, pause/resume, emergency stop,
and strict Category C human-in-the-loop approvals.
"""

import asyncio
import time
import uuid
import aiosqlite
from typing import Dict, Any, List, Optional
from agent.browser.manager import browser_manager
from agent.tools.registry import tool_registry
from agent.permissions.policy import SafetyPolicy, ActionCategory, ActionApproval, ApprovalStatus
from agent.memory.db import db
from agent.providers.llm import LLMFactory, TaskPlan, ActionDecision


class TaskState:
    PENDING = "pending"
    PLANNING = "planning"
    RUNNING = "running"
    PAUSED = "paused"
    WAITING_FOR_APPROVAL = "waiting_for_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskEngine:
    def __init__(self):
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        self.approval_events: Dict[str, asyncio.Event] = {}

    async def start_task(
        self,
        instruction: str,
        mode: str = "autonomous",
        max_steps: int = 15,
        timeout_seconds: int = 180,
        target_url: Optional[str] = None
    ) -> str:
        task_id = f"task_{uuid.uuid4().hex[:8]}"

        task_record = {
            "id": task_id,
            "instruction": instruction,
            "mode": mode,
            "status": TaskState.PENDING,
            "max_steps": max_steps,
            "timeout_seconds": timeout_seconds,
            "step_index": 0,
            "plan": [],
            "executed_steps": [],
            "results": {},
            "target_url": target_url or "http://127.0.0.1:8765",
            "cancel_requested": False,
            "pause_requested": False,
            "current_step_description": "Initializing task...",
            "created_at": time.time(),
            "updated_at": time.time()
        }

        self.active_tasks[task_id] = task_record
        await db.save_task(task_record)

        # Launch autonomous execution in background
        asyncio.create_task(self._run_task_loop(task_id))
        return task_id

    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        if task_id in self.active_tasks:
            return self.active_tasks[task_id]
        return await db.get_task(task_id)

    async def pause_task(self, task_id: str) -> bool:
        if task_id in self.active_tasks:
            self.active_tasks[task_id]["pause_requested"] = True
            self.active_tasks[task_id]["status"] = TaskState.PAUSED
            await db.save_task(self.active_tasks[task_id])
            return True
        return False

    async def resume_task(self, task_id: str) -> bool:
        if task_id in self.active_tasks and self.active_tasks[task_id]["status"] == TaskState.PAUSED:
            self.active_tasks[task_id]["pause_requested"] = False
            self.active_tasks[task_id]["status"] = TaskState.RUNNING
            asyncio.create_task(self._run_task_loop(task_id))
            return True
        return False

    async def cancel_task(self, task_id: str) -> bool:
        if task_id in self.active_tasks:
            self.active_tasks[task_id]["cancel_requested"] = True
            self.active_tasks[task_id]["status"] = TaskState.CANCELLED
            self.active_tasks[task_id]["current_step_description"] = "Halted by user emergency stop."
            await db.save_task(self.active_tasks[task_id])
            return True
        return False

    async def decide_approval(self, approval_id: str, approved: bool, reason: str = "") -> bool:
        pending = await db.get_pending_approvals()
        target = next((a for a in pending if a["id"] == approval_id), None)
        if not target:
            return False

        target["status"] = ApprovalStatus.APPROVED.value if approved else ApprovalStatus.REJECTED.value
        target["decided_at"] = time.time()
        target["reason"] = reason
        await db.save_approval(target)

        # Trigger awaiting event
        if approval_id in self.approval_events:
            self.approval_events[approval_id].set()

        return True

    async def _run_task_loop(self, task_id: str):
        task = self.active_tasks.get(task_id)
        if not task:
            return

        deadline = time.time() + task["timeout_seconds"]
        settings = await db.get_all_settings()
        prov_name = settings.get("provider", "heuristic")
        api_key = settings.get("api_key", "")
        model_name = settings.get("model_name", "")
        provider = LLMFactory.get_provider(prov_name, api_key=api_key, model_name=model_name)

        try:
            # 1. PLAN PHASE
            task["status"] = TaskState.PLANNING
            task["current_step_description"] = "Analyzing instruction and generating execution plan..."
            await db.save_task(task)

            plan: TaskPlan = await provider.create_plan(
                instruction=task["instruction"],
                context={"target_url": task["target_url"]}
            )
            task["plan"] = [step.model_dump() for step in plan.steps]
            task["status"] = TaskState.RUNNING
            await db.save_task(task)

            # Execution loop: OBSERVE -> ACT -> VERIFY -> REPLAN
            while task["step_index"] < len(plan.steps) and task["step_index"] < task["max_steps"]:
                # Check for cancellation or pause
                if task["cancel_requested"]:
                    task["status"] = TaskState.CANCELLED
                    break

                if task["pause_requested"]:
                    task["status"] = TaskState.PAUSED
                    break

                if time.time() > deadline:
                    task["status"] = TaskState.FAILED
                    task["error_message"] = "Task reached maximum global execution deadline."
                    break

                step_idx = task["step_index"]
                current_plan_step = plan.steps[step_idx]
                task["current_step_description"] = f"Step {step_idx + 1}/{len(plan.steps)}: {current_plan_step.description}"
                await db.save_task(task)

                # 2. OBSERVE PHASE
                observation = await browser_manager.inspect_dom()
                screenshot_b64, screenshot_path = await browser_manager.take_screenshot(save_to_disk=True)
                task["latest_screenshot"] = screenshot_b64

                # Save checkpoint
                await db.save_checkpoint(
                    task_id=task_id,
                    step_index=step_idx,
                    url=observation.get("url", ""),
                    title=observation.get("title", ""),
                    screenshot_path=screenshot_path,
                    dom_summary=observation.get("body_summary", "")[:500]
                )

                # Check for CAPTCHA challenge (only if staying on this page, not navigating away)
                if observation.get("has_captcha") and current_plan_step.tool_name != "navigate":
                    task["status"] = TaskState.PAUSED
                    task["current_step_description"] = "CAPTCHA or security challenge detected. Please complete it in the browser, then click Resume."
                    await db.save_task(task)
                    break

                # 3. DECIDE NEXT ACTION
                decision: ActionDecision = await provider.decide_next_step(
                    instruction=task["instruction"],
                    plan=plan,
                    step_index=step_idx,
                    observation=observation,
                    history=task["executed_steps"]
                )

                if decision.action == "finish":
                    break

                tool_name = decision.tool_name or current_plan_step.tool_name
                params = decision.parameters or current_plan_step.parameters

                # 4. SAFETY & PERMISSION CHECK
                category = SafetyPolicy.classify_action(tool_name, params)

                # Category C: Consequential Action -> Require explicit user approval!
                if category == ActionCategory.CATEGORY_C or decision.is_consequential:
                    approval_id = f"appr_{uuid.uuid4().hex[:8]}"
                    approval_data = {
                        "id": approval_id,
                        "task_id": task_id,
                        "category": ActionCategory.CATEGORY_C.value,
                        "action_name": tool_name,
                        "description": f"Consequential action: {current_plan_step.description}",
                        "parameters": SafetyPolicy.mask_sensitive_data(params),
                        "risk_summary": "This action submits data, confirms a transaction, or modifies state. Explicit approval is required.",
                        "status": ApprovalStatus.PENDING.value,
                        "requested_at": time.time()
                    }
                    await db.save_approval(approval_data)

                    task["status"] = TaskState.WAITING_FOR_APPROVAL
                    task["current_step_description"] = f"Awaiting user approval for consequential action: {tool_name}"
                    task["current_approval_id"] = approval_id
                    await db.save_task(task)

                    # Block until approval is decided
                    event = asyncio.Event()
                    self.approval_events[approval_id] = event
                    try:
                        # Wait up to 120 seconds for user approval in UI
                        await asyncio.wait_for(event.wait(), timeout=120)
                    except asyncio.TimeoutError:
                        task["status"] = TaskState.FAILED
                        task["error_message"] = "Approval request timed out."
                        break
                    finally:
                        del self.approval_events[approval_id]

                    # Check if approved
                    is_approved = False
                    async with aiosqlite.connect(db.db_path) as conn:
                        conn.row_factory = aiosqlite.Row
                        cur = await conn.execute("SELECT status FROM approvals WHERE id = ?", (approval_id,))
                        row = await cur.fetchone()
                        if row and row["status"] == ApprovalStatus.APPROVED.value:
                            is_approved = True

                    if not is_approved:
                        task["status"] = TaskState.CANCELLED
                        task["error_message"] = "Consequential action rejected by user."
                        await db.save_task(task)
                        break

                    task["status"] = TaskState.RUNNING
                    task["current_approval_id"] = None
                    await db.save_task(task)

                # 5. ACT PHASE: Execute Tool
                tool_res = await tool_registry.execute_tool(tool_name, params)

                # 6. VERIFY PHASE: Check Result
                post_obs = await browser_manager.inspect_dom()
                verified = tool_res.success
                if not verified:
                    # Bounded retry: retry once after short backoff
                    await asyncio.sleep(1.0)
                    tool_res = await tool_registry.execute_tool(tool_name, params)
                    verified = tool_res.success

                step_record = {
                    "step": step_idx + 1,
                    "tool": tool_name,
                    "description": current_plan_step.description,
                    "params": SafetyPolicy.mask_sensitive_data(params),
                    "success": verified,
                    "output": tool_res.data,
                    "error": tool_res.error,
                    "timestamp": time.time()
                }
                task["executed_steps"].append(step_record)
                task["step_index"] += 1
                await db.save_task(task)

                # Brief pacing between actions
                await asyncio.sleep(0.5)

            # Task loop completed
            if task["status"] in (TaskState.RUNNING, TaskState.PLANNING):
                task["status"] = TaskState.COMPLETED
                task["current_step_description"] = "Task completed successfully."
                # Generate final summary
                summary = await provider.summarize_results(task["instruction"], task["executed_steps"])
                step_outputs = [s.get("output") for s in task["executed_steps"] if s.get("output")]
                task["results"] = {
                    "summary": summary,
                    "total_steps": len(task["executed_steps"]),
                    "sources": [task["target_url"]],
                    "artifacts": step_outputs
                }
                await db.save_task(task)

        except Exception as e:
            task["status"] = TaskState.FAILED
            task["error_message"] = f"Execution error: {str(e)}"
            task["current_step_description"] = f"Error: {str(e)}"
            await db.save_task(task)


# Global singleton instance
task_engine = TaskEngine()
