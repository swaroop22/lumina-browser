"""
Lumina AI Browser - Playwright Browser Manager
Provides real Chromium automation, persistent session contexts, multi-tab orchestration,
accessible DOM inspection, action execution, and screenshot capture.
"""

import asyncio
import os
import time
import base64
from typing import Dict, List, Optional, Any, Tuple
from playwright.async_api import async_playwright, BrowserContext, Page, Playwright

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data"
)
SCREENSHOTS_DIR = os.path.join(DATA_DIR, "screenshots")
DOWNLOADS_DIR = os.path.join(DATA_DIR, "downloads")
BROWSER_PROFILE_DIR = os.path.join(DATA_DIR, "browser_profile")


class TabInfo:
    def __init__(self, tab_id: str, page: Page):
        self.tab_id = tab_id
        self.page = page
        self.created_at = time.time()
        self.last_screenshot_b64: Optional[str] = None

    async def get_metadata(self, is_active: bool = False) -> Dict[str, Any]:
        try:
            title = await self.page.title()
            url = self.page.url
        except Exception:
            title = "Loading..."
            url = "about:blank"
        return {
            "id": self.tab_id,
            "title": title or "Untitled",
            "url": url,
            "is_active": is_active,
            "created_at": self.created_at,
        }


class BrowserManager:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.playwright: Optional[Playwright] = None
        self.context: Optional[BrowserContext] = None
        self.tabs: Dict[str, TabInfo] = {}
        self.active_tab_id: Optional[str] = None
        self.lock = asyncio.Lock()
        self._is_initialized = False

        os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
        os.makedirs(DOWNLOADS_DIR, exist_ok=True)
        os.makedirs(BROWSER_PROFILE_DIR, exist_ok=True)

    async def initialize(self):
        async with self.lock:
            if self._is_initialized:
                return

            REAL_CHROME_UA = (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "WebKit/537.36 (KHTML, like Gecko) "
                "Chrome/128.0.0.0 Safari/537.36"
            )
            self.playwright = await async_playwright().start()
            # Launch persistent browser context for cookie and session preservation
            self.context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=BROWSER_PROFILE_DIR,
                headless=self.headless,
                viewport={"width": 1280, "height": 800},
                accept_downloads=True,
                user_agent=REAL_CHROME_UA,
                locale="en-US",
                timezone_id="America/New_York",
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-infobars",
                ]
            )
            # Stealth: neutralize navigator.webdriver flag
            await self.context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
            )

            # Check existing pages or create first tab
            existing_pages = self.context.pages
            if existing_pages:
                for idx, page in enumerate(existing_pages):
                    tab_id = f"tab_{idx + 1}"
                    self.tabs[tab_id] = TabInfo(tab_id, page)
                self.active_tab_id = list(self.tabs.keys())[0]
            else:
                page = await self.context.new_page()
                try:
                    await page.goto("http://127.0.0.1:8765/test-site/laptops", timeout=5000)
                except Exception:
                    pass
                tab_id = "tab_1"
                self.tabs[tab_id] = TabInfo(tab_id, page)
                self.active_tab_id = tab_id

            self._is_initialized = True

    async def get_active_page(self) -> Page:
        if not self._is_initialized:
            await self.initialize()

        if not self.active_tab_id or self.active_tab_id not in self.tabs:
            if self.tabs:
                self.active_tab_id = list(self.tabs.keys())[0]
            else:
                # Create a new tab
                await self.create_tab()

        return self.tabs[self.active_tab_id].page

    async def list_tabs(self) -> List[Dict[str, Any]]:
        if not self._is_initialized:
            await self.initialize()

        result = []
        for tab_id, tab_info in list(self.tabs.items()):
            try:
                # Check if page is closed
                if tab_info.page.is_closed():
                    del self.tabs[tab_id]
                    continue
                meta = await tab_info.get_metadata(is_active=(tab_id == self.active_tab_id))
                result.append(meta)
            except Exception:
                continue

        if not self.tabs:
            await self.create_tab()
            return await self.list_tabs()

        return result

    async def create_tab(self, url: str = "about:blank") -> Dict[str, Any]:
        if not self._is_initialized:
            await self.initialize()

        tab_id = f"tab_{int(time.time() * 1000)}"
        page = await self.context.new_page()
        self.tabs[tab_id] = TabInfo(tab_id, page)
        self.active_tab_id = tab_id

        if url and url != "about:blank":
            await self.navigate(url)

        return await self.tabs[tab_id].get_metadata(is_active=True)

    async def switch_tab(self, tab_id: str) -> bool:
        if tab_id in self.tabs and not self.tabs[tab_id].page.is_closed():
            self.active_tab_id = tab_id
            try:
                await asyncio.wait_for(self.tabs[tab_id].page.bring_to_front(), timeout=2.0)
            except Exception:
                pass
            return True
        return False

    async def close_tab(self, tab_id: str) -> bool:
        if tab_id in self.tabs:
            try:
                await asyncio.wait_for(self.tabs[tab_id].page.close(), timeout=2.0)
            except Exception:
                pass
            del self.tabs[tab_id]

            if self.active_tab_id == tab_id:
                self.active_tab_id = list(self.tabs.keys())[0] if self.tabs else None

            if not self.tabs:
                await self.create_tab()

            return True
        return False

    async def navigate(self, url: str, wait_until: str = "domcontentloaded") -> Dict[str, Any]:
        page = await self.get_active_page()
        if not url.startswith(("http://", "https://", "about:")):
            url = f"https://{url}"

        try:
            response = await page.goto(url, wait_until=wait_until, timeout=15000)
            status_code = response.status if response else 200
        except Exception:
            try:
                response = await page.goto(url, wait_until="commit", timeout=10000)
                status_code = response.status if response else 200
            except Exception:
                status_code = 500

        # Wait briefly for client animations or initial hydration
        await asyncio.sleep(0.3)

        title = await page.title()
        current_url = page.url
        return {
            "url": current_url,
            "title": title,
            "status": status_code,
            "tab_id": self.active_tab_id
        }

    async def go_back(self) -> Dict[str, Any]:
        page = await self.get_active_page()
        try:
            await page.go_back(timeout=10000)
        except Exception:
            pass
        return {"url": page.url, "title": await page.title()}

    async def go_forward(self) -> Dict[str, Any]:
        page = await self.get_active_page()
        try:
            await page.go_forward(timeout=10000)
        except Exception:
            pass
        return {"url": page.url, "title": await page.title()}

    async def reload(self) -> Dict[str, Any]:
        page = await self.get_active_page()
        try:
            await page.reload(timeout=15000)
        except Exception:
            pass
        return {"url": page.url, "title": await page.title()}

    async def click(self, selector: str, text: Optional[str] = None) -> bool:
        page = await self.get_active_page()
        try:
            if text:
                # Try finding by role or text content
                locator = page.get_by_text(text, exact=False).first
                if await locator.count() > 0:
                    await locator.click(timeout=10000)
                    await asyncio.sleep(0.5)
                    return True

            # Standard selector click
            locator = page.locator(selector).first
            await locator.click(timeout=10000)
            await asyncio.sleep(0.5)
            return True
        except Exception as err:
            # Fallback to JavaScript dispatch click
            try:
                res = await page.evaluate(f"""() => {{
                    const el = document.querySelector("{selector}");
                    if (el) {{
                        el.click();
                        return true;
                    }}
                    return false;
                }}""")
                await asyncio.sleep(0.5)
                return bool(res)
            except Exception:
                raise err

    async def fill(self, selector: str, value: str) -> bool:
        page = await self.get_active_page()
        locator = page.locator(selector).first
        await locator.fill(value, timeout=10000)
        await asyncio.sleep(0.2)
        return True

    async def select_option(self, selector: str, value_or_label: str) -> bool:
        page = await self.get_active_page()
        locator = page.locator(selector).first
        await locator.select_option(value=value_or_label, timeout=10000)
        return True

    async def scroll(self, direction: str = "down", amount: int = 500) -> bool:
        page = await self.get_active_page()
        delta_y = amount if direction == "down" else -amount
        await page.mouse.wheel(0, delta_y)
        await asyncio.sleep(0.4)
        return True

    async def take_screenshot(self, save_to_disk: bool = True) -> Tuple[str, str]:
        """
        Takes a screenshot of the active page.
        Returns: (base64_string, file_path)
        """
        page = await self.get_active_page()
        filename = f"screenshot_{int(time.time() * 1000)}.png"
        filepath = os.path.join(SCREENSHOTS_DIR, filename)

        screenshot_bytes = await page.screenshot(type="png", full_page=False)
        b64_str = base64.b64encode(screenshot_bytes).decode("utf-8")

        if save_to_disk:
            with open(filepath, "wb") as f:
                f.write(screenshot_bytes)

        if self.active_tab_id and self.active_tab_id in self.tabs:
            self.tabs[self.active_tab_id].last_screenshot_b64 = b64_str

        return b64_str, filepath

    async def inspect_dom(self) -> Dict[str, Any]:
        """
        Extracts semantic DOM elements, interactive buttons, inputs, links, forms,
        and visible text from the page for agent planning.
        """
        page = await self.get_active_page()
        title = await page.title()
        url = page.url

        # Fast DOM extractor executing in browser context
        script = """() => {
            function getCleanText(el) {
                return (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
            }

            const interactiveElements = [];
            let elementId = 1;

            // Collect inputs, textareas, selects
            const inputs = document.querySelectorAll('input, textarea, select');
            inputs.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden') {
                    const label = el.labels && el.labels[0] ? getCleanText(el.labels[0]) : '';
                    interactiveElements.push({
                        id: elementId++,
                        tag: el.tagName.toLowerCase(),
                        type: el.type || 'text',
                        name: el.name || '',
                        placeholder: el.placeholder || '',
                        value: el.value || '',
                        label: label || el.getAttribute('aria-label') || el.name || el.id || '',
                        selector: el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : `${el.tagName.toLowerCase()}[type="${el.type || 'text'}"]`),
                        is_visible: true
                    });
                }
            });

            // Collect buttons
            const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
            buttons.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden') {
                    const text = getCleanText(el) || el.value || el.getAttribute('aria-label') || '';
                    if (text) {
                        interactiveElements.push({
                            id: elementId++,
                            tag: 'button',
                            text: text.slice(0, 80),
                            selector: el.id ? `#${el.id}` : `button:has-text("${text.slice(0, 30)}")`,
                            is_visible: true
                        });
                    }
                }
            });

            // Collect links
            const links = document.querySelectorAll('a[href]');
            const sampledLinks = [];
            links.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden') {
                    const text = getCleanText(el);
                    const href = el.getAttribute('href');
                    if (text && href && !href.startsWith('javascript:')) {
                        sampledLinks.push({
                            text: text.slice(0, 80),
                            href: href,
                            selector: `a[href="${href}"]`
                        });
                    }
                }
            });

            // Get headings and main content
            const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
                .map(h => ({ level: h.tagName.toLowerCase(), text: getCleanText(h) }))
                .filter(h => h.text.length > 0)
                .slice(0, 15);

            // Extract body text summary (first 3000 chars)
            const bodyText = (document.body.innerText || '').slice(0, 4000);
            const bodyLower = bodyText.toLowerCase();

            // Specific CAPTCHA or Cloudflare challenge detection
            const hasChallengeElem = document.querySelector(
                '#challenge-running, #cf-challenge-running, .cf-turnstile, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], div[class*="captcha-container"]'
            ) !== null;
            const titleLower = (document.title || '').toLowerCase();
            const hasChallengeTitle = titleLower.includes('just a moment...') || 
                                      titleLower.includes('security check') || 
                                      titleLower.includes('attention required') ||
                                      titleLower.includes('challenge');
            const hasChallengeText = bodyLower.includes('verify you are human') || 
                                     bodyLower.includes('press & hold to confirm you are a human') ||
                                     bodyLower.includes('please complete the security check to continue');

            const hasCaptcha = hasChallengeElem || hasChallengeTitle || hasChallengeText;

            return {
                interactive_elements: interactiveElements.slice(0, 50),
                links: sampledLinks.slice(0, 30),
                headings: headings,
                body_summary: bodyText,
                has_captcha: hasCaptcha
            };
        }"""

        try:
            dom_data = await page.evaluate(script)
        except Exception as e:
            dom_data = {
                "interactive_elements": [],
                "links": [],
                "headings": [],
                "body_summary": "",
                "has_captcha": False,
                "error": str(e)
            }

        return {
            "url": url,
            "title": title,
            "has_captcha": dom_data.get("has_captcha", False),
            "headings": dom_data.get("headings", []),
            "interactive_elements": dom_data.get("interactive_elements", []),
            "links": dom_data.get("links", []),
            "body_summary": dom_data.get("body_summary", "")
        }

    async def get_page_text(self) -> str:
        page = await self.get_active_page()
        try:
            return await page.evaluate("() => document.body ? document.body.innerText : ''")
        except Exception:
            return ""

    async def evaluate_script(self, script: str) -> Any:
        page = await self.get_active_page()
        return await page.evaluate(script)

    async def close(self):
        async with self.lock:
            if self.context:
                await self.context.close()
                self.context = None
            if self.playwright:
                await self.playwright.stop()
                self.playwright = None
            self.tabs.clear()
            self._is_initialized = False


# Global singleton instance
browser_manager = BrowserManager()
