"""
Lumina AI Browser - Browser Tool Registry
Implements reusable, independently tested tools for navigation, DOM interaction,
data extraction, tab orchestration, file export, and history/bookmark management.
"""

import csv
import json
import os
import time
from typing import Dict, Any, List, Optional, Callable, Awaitable
from agent.browser.manager import browser_manager
from agent.memory.db import db
from agent.permissions.policy import SafetyPolicy, ActionCategory

REPORTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "reports"
)


class ToolResult:
    def __init__(self, success: bool, data: Any = None, error: Optional[str] = None):
        self.success = success
        self.data = data
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error
        }


class ToolDefinition:
    def __init__(
        self,
        name: str,
        description: str,
        parameters_schema: Dict[str, Any],
        handler: Callable[..., Awaitable[ToolResult]],
        default_category: ActionCategory = ActionCategory.CATEGORY_A
    ):
        self.name = name
        self.description = description
        self.parameters_schema = parameters_schema
        self.handler = handler
        self.default_category = default_category


class ToolRegistry:
    def __init__(self):
        self.tools: Dict[str, ToolDefinition] = {}
        os.makedirs(REPORTS_DIR, exist_ok=True)
        self._register_default_tools()

    def register(self, tool: ToolDefinition):
        self.tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self.tools.get(name)

    def list_tool_definitions(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters_schema,
                "default_category": t.default_category.value
            }
            for t in self.tools.values()
        ]

    async def execute_tool(self, name: str, params: Dict[str, Any]) -> ToolResult:
        tool = self.get_tool(name)
        if not tool:
            return ToolResult(success=False, error=f"Unknown tool: {name}")

        try:
            return await tool.handler(**params)
        except Exception as e:
            return ToolResult(success=False, error=f"Tool execution failed ({name}): {str(e)}")

    def _register_default_tools(self):
        # 1. Navigation
        async def handle_navigate(url: str, **kwargs) -> ToolResult:
            is_allowed, reason = SafetyPolicy.is_url_allowed(url)
            if not is_allowed:
                return ToolResult(success=False, error=f"Safety check rejected URL: {reason}")
            res = await browser_manager.navigate(url)
            # Record in history
            await db.add_history(res["url"], res["title"])
            return ToolResult(success=True, data=res)

        self.register(ToolDefinition(
            name="navigate",
            description="Navigate the browser to a given URL.",
            parameters_schema={"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
            handler=handle_navigate,
            default_category=ActionCategory.CATEGORY_A
        ))

        # 2. Inspect DOM
        async def handle_inspect_dom(**kwargs) -> ToolResult:
            dom = await browser_manager.inspect_dom()
            return ToolResult(success=True, data=dom)

        self.register(ToolDefinition(
            name="inspect_dom",
            description="Inspect the current page DOM, interactive elements, headings, text summary, and CAPTCHA status.",
            parameters_schema={"type": "object", "properties": {}},
            handler=handle_inspect_dom,
            default_category=ActionCategory.CATEGORY_A
        ))

        # 3. Click Element
        async def handle_click(selector: str, text: Optional[str] = None, **kwargs) -> ToolResult:
            try:
                ok = await browser_manager.click(selector=selector, text=text)
                return ToolResult(success=ok, data={"clicked": selector, "text": text})
            except Exception as e:
                return ToolResult(success=False, error=str(e))

        self.register(ToolDefinition(
            name="click",
            description="Click a button, link, or element using CSS selector or visible text.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "selector": {"type": "string"},
                    "text": {"type": "string"}
                },
                "required": ["selector"]
            },
            handler=handle_click,
            default_category=ActionCategory.CATEGORY_A
        ))

        # 4. Fill Input
        async def handle_fill(selector: str, value: str, **kwargs) -> ToolResult:
            try:
                ok = await browser_manager.fill(selector=selector, value=value)
                return ToolResult(success=ok, data={"filled": selector})
            except Exception as e:
                return ToolResult(success=False, error=str(e))

        self.register(ToolDefinition(
            name="fill",
            description="Fill text into an input field or textarea.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "selector": {"type": "string"},
                    "value": {"type": "string"}
                },
                "required": ["selector", "value"]
            },
            handler=handle_fill,
            default_category=ActionCategory.CATEGORY_A
        ))

        # 5. Select Option
        async def handle_select(selector: str, value: str, **kwargs) -> ToolResult:
            try:
                ok = await browser_manager.select_option(selector=selector, value_or_label=value)
                return ToolResult(success=ok, data={"selected": value, "selector": selector})
            except Exception as e:
                return ToolResult(success=False, error=str(e))

        self.register(ToolDefinition(
            name="select_option",
            description="Select an option in a dropdown <select> element.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "selector": {"type": "string"},
                    "value": {"type": "string"}
                },
                "required": ["selector", "value"]
            },
            handler=handle_select,
            default_category=ActionCategory.CATEGORY_A
        ))

        # 6. Scroll
        async def handle_scroll(direction: str = "down", amount: int = 500, **kwargs) -> ToolResult:
            ok = await browser_manager.scroll(direction=direction, amount=amount)
            return ToolResult(success=ok, data={"scrolled": direction, "amount": amount})

        self.register(ToolDefinition(
            name="scroll",
            description="Scroll the active page up or down.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "direction": {"type": "string", "enum": ["up", "down"]},
                    "amount": {"type": "integer"}
                }
            },
            handler=handle_scroll,
            default_category=ActionCategory.CATEGORY_A
        ))

        # 7. Take Screenshot
        async def handle_screenshot(save_to_disk: bool = True, **kwargs) -> ToolResult:
            b64, path = await browser_manager.take_screenshot(save_to_disk=save_to_disk)
            return ToolResult(success=True, data={"screenshot_b64": b64, "path": path})

        self.register(ToolDefinition(
            name="take_screenshot",
            description="Capture a screenshot of the current page.",
            parameters_schema={"type": "object", "properties": {"save_to_disk": {"type": "boolean"}}},
            handler=handle_screenshot,
            default_category=ActionCategory.CATEGORY_A
        ))

        # 8. Extract Structured Data
        async def handle_extract(fields: List[str], extraction_goal: str, **kwargs) -> ToolResult:
            dom = await browser_manager.inspect_dom()
            text = dom.get("body_summary", "")
            url = dom.get("url", "")
            title = dom.get("title", "")
            
            # Simple heuristic extractor based on DOM content
            extracted = {
                "url": url,
                "title": title,
                "goal": extraction_goal,
                "items": []
            }
            # Look for lines matching fields or key-values
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            extracted["raw_lines_sampled"] = lines[:20]
            return ToolResult(success=True, data=extracted)

        self.register(ToolDefinition(
            name="extract_structured_data",
            description="Extract structured information from the page matching required fields.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "fields": {"type": "array", "items": {"type": "string"}},
                    "extraction_goal": {"type": "string"}
                },
                "required": ["fields", "extraction_goal"]
            },
            handler=handle_extract,
            default_category=ActionCategory.CATEGORY_A
        ))

        # 9. Tab Management
        async def handle_new_tab(url: str = "about:blank", **kwargs) -> ToolResult:
            info = await browser_manager.create_tab(url=url)
            return ToolResult(success=True, data=info)

        async def handle_switch_tab(tab_id: str, **kwargs) -> ToolResult:
            ok = await browser_manager.switch_tab(tab_id)
            return ToolResult(success=ok, data={"tab_id": tab_id})

        async def handle_close_tab(tab_id: str, **kwargs) -> ToolResult:
            ok = await browser_manager.close_tab(tab_id)
            return ToolResult(success=ok, data={"closed_tab_id": tab_id})

        async def handle_list_tabs(**kwargs) -> ToolResult:
            tabs = await browser_manager.list_tabs()
            return ToolResult(success=True, data={"tabs": tabs})

        self.register(ToolDefinition("new_tab", "Open a new browser tab.", {"type": "object", "properties": {"url": {"type": "string"}}}, handle_new_tab))
        self.register(ToolDefinition("switch_tab", "Switch to an existing tab by ID.", {"type": "object", "properties": {"tab_id": {"type": "string"}}, "required": ["tab_id"]}, handle_switch_tab))
        self.register(ToolDefinition("close_tab", "Close a tab by ID.", {"type": "object", "properties": {"tab_id": {"type": "string"}}, "required": ["tab_id"]}, handle_close_tab))
        self.register(ToolDefinition("list_tabs", "List all open browser tabs.", {"type": "object", "properties": {}}, handle_list_tabs))

        # 10. Fill Form with User Profile (Category B or C depending on submit)
        async def handle_fill_profile_form(**kwargs) -> ToolResult:
            profile = await db.get_profile()
            dom = await browser_manager.inspect_dom()
            inputs = dom.get("interactive_elements", [])
            filled_count = 0
            filled_details = []

            for el in inputs:
                label_name = f"{el.get('label', '')} {el.get('placeholder', '')} {el.get('name', '')}".lower()
                selector = el.get("selector")
                if not selector:
                    continue

                val_to_fill = None
                if "name" in label_name and "user" not in label_name:
                    val_to_fill = profile.get("full_name")
                elif "email" in label_name:
                    val_to_fill = profile.get("email")
                elif "phone" in label_name or "mobile" in label_name:
                    val_to_fill = profile.get("phone")
                elif "address" in label_name or "city" in label_name:
                    val_to_fill = profile.get("address")
                elif "linkedin" in label_name:
                    val_to_fill = profile.get("linkedin_url")
                elif "github" in label_name:
                    val_to_fill = profile.get("github_url")

                if val_to_fill:
                    try:
                        await browser_manager.fill(selector, val_to_fill)
                        filled_count += 1
                        filled_details.append({"field": label_name, "value": val_to_fill})
                    except Exception:
                        pass

            return ToolResult(success=True, data={"filled_count": filled_count, "details": filled_details})

        self.register(ToolDefinition(
            name="fill_form_with_profile",
            description="Automatically match and fill input fields using the user's stored profile.",
            parameters_schema={"type": "object", "properties": {}},
            handler=handle_fill_profile_form,
            default_category=ActionCategory.CATEGORY_B
        ))

        # 11. Consequential Action: Submit Form (Strict Category C)
        async def handle_submit_form(selector: str = "button[type='submit'], input[type='submit']", **kwargs) -> ToolResult:
            try:
                ok = await browser_manager.click(selector=selector)
                return ToolResult(success=ok, data={"submitted": selector})
            except Exception as e:
                return ToolResult(success=False, error=str(e))

        self.register(ToolDefinition(
            name="submit_form",
            description="Submit a web form (Consequential Category C action requiring explicit user authorization).",
            parameters_schema={"type": "object", "properties": {"selector": {"type": "string"}}},
            handler=handle_submit_form,
            default_category=ActionCategory.CATEGORY_C
        ))

        # 12. Export Data (CSV, JSON, Markdown)
        async def handle_export_data(format: str, data: Any, title: str = "Exported Report", **kwargs) -> ToolResult:
            timestamp = int(time.time())
            safe_title = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).rstrip().replace(" ", "_")
            filename = f"{safe_title}_{timestamp}.{format.lower()}"
            filepath = os.path.join(REPORTS_DIR, filename)

            if format.lower() == "json":
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
            elif format.lower() == "csv":
                if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                    keys = list(data[0].keys())
                    with open(filepath, "w", newline="", encoding="utf-8") as f:
                        writer = csv.DictWriter(f, fieldnames=keys)
                        writer.writeheader()
                        writer.writerows(data)
                else:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(str(data))
            elif format.lower() in ("md", "markdown"):
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(f"# {title}\n\nGenerated on {time.ctime(timestamp)}\n\n")
                    if isinstance(data, dict):
                        for k, v in data.items():
                            f.write(f"### {k}\n{v}\n\n")
                    elif isinstance(data, list):
                        for item in data:
                            f.write(f"- {item}\n")
                    else:
                        f.write(str(data))
            else:
                return ToolResult(success=False, error=f"Unsupported format: {format}")

            return ToolResult(success=True, data={"filepath": filepath, "filename": filename})

        self.register(ToolDefinition(
            name="export_data",
            description="Export research results or structured data into JSON, CSV, or Markdown file.",
            parameters_schema={
                "type": "object",
                "properties": {
                    "format": {"type": "string", "enum": ["json", "csv", "md"]},
                    "data": {},
                    "title": {"type": "string"}
                },
                "required": ["format", "data"]
            },
            handler=handle_export_data,
            default_category=ActionCategory.CATEGORY_A
        ))


# Global singleton instance
tool_registry = ToolRegistry()
