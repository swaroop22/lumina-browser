"""
Lumina AI Browser - Permissions and Safety Architecture
Enforces Category A (Routine), Category B (Sensitive), Category C (Consequential) boundaries,
blocks prompt injection, prevents SSRF / unsafe file URI access, and protects user credentials.
"""

from enum import Enum
from typing import Optional, Dict, Any, List
import re
from pydantic import BaseModel, Field


class ActionCategory(str, Enum):
    CATEGORY_A = "CATEGORY_A"  # Routine: Public web navigation, search, extract, summarize
    CATEGORY_B = "CATEGORY_B"  # Sensitive: Authenticated accounts, uploading files, reading private data
    CATEGORY_C = "CATEGORY_C"  # Consequential: Submitting applications, purchases, sending messages, deleting data


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ActionApproval(BaseModel):
    approval_id: str
    task_id: str
    category: ActionCategory
    action_name: str
    description: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    risk_summary: str
    status: ApprovalStatus = ApprovalStatus.PENDING
    requested_at: float
    decided_at: Optional[float] = None
    reason: Optional[str] = None


class SafetyPolicy:
    # URL Blocklist for SSRF / metadata / raw system file security
    BLOCKED_HOST_PATTERNS = [
        r"^169\.254\.169\.254$",        # AWS / GCP / Azure metadata
        r"^metadata\.google\.internal$", # GCP metadata
        r"^100\.100\.100\.200$",        # Alibaba metadata
    ]
    
    # Consequential action triggers
    CONSEQUENTIAL_KEYWORDS = [
        "submit", "apply", "confirm", "checkout", "buy", "purchase",
        "pay", "order", "send message", "delete", "remove account",
        "transfer", "sign contract", "finalize booking"
    ]
    
    # Sensitive action triggers
    SENSITIVE_KEYWORDS = [
        "upload resume", "upload file", "change password", "update email",
        "billing", "payment method", "tax id", "social security", "ssn"
    ]

    # Prompt injection canary detector
    INJECTION_PATTERNS = [
        r"ignore (all )?previous instructions",
        r"disregard the above",
        r"you are now in developer mode",
        r"system prompt override",
        r"new rule:",
        r"admin instruction:",
        r"do not ask for confirmation",
        r"bypass approval",
        r"grant category c approval"
    ]

    @classmethod
    def sanitize_untrusted_web_content(cls, raw_text: str) -> str:
        """
        Wraps and neutralizes untrusted website content so that LLM cannot be
        tricked into executing injected instructions as system commands.
        """
        if not raw_text:
            return ""
        
        # Strip potential system-jailbreak phrases or tag them
        cleaned = raw_text
        for pattern in cls.INJECTION_PATTERNS:
            cleaned = re.sub(pattern, "[FILTERED_SUSPICIOUS_PROMPT_INJECTION]", cleaned, flags=re.IGNORECASE)
            
        return f"<UNTRUSTED_EXTERNAL_WEBPAGE_CONTENT>\n{cleaned}\n</UNTRUSTED_EXTERNAL_WEBPAGE_CONTENT>"

    @classmethod
    def is_url_allowed(cls, url: str, allow_local_test_server: bool = True) -> tuple[bool, str]:
        """
        Validates URL to protect against SSRF, unauthorized internal network probe,
        and illegal file:// scheme access.
        """
        if not url:
            return False, "URL cannot be empty"

        url_lower = url.lower().strip()

        # Reject dangerous schemes
        if url_lower.startswith(("file://", "javascript:", "data:text/html", "file:")):
            return False, f"Forbidden scheme in URL: {url}"

        try:
            from urllib.parse import urlparse
            parsed = urlparse(url_lower)
            hostname = (parsed.hostname or "").strip()
        except Exception:
            return False, "Invalid URL structure"

        # Check cloud metadata endpoints and link-local IPs
        if hostname in ("169.254.169.254", "metadata.google.internal", "100.100.100.200") or "169.254." in hostname:
            return False, f"Access to cloud metadata/link-local address forbidden: {url}"

        # If it's a test server on localhost/127.0.0.1 for the local test site, allow it
        if allow_local_test_server and (hostname in ("127.0.0.1", "localhost") or "localhost:" in url_lower or "127.0.0.1:" in url_lower):
            return True, "Permitted local test address"

        return True, "URL approved"

    @classmethod
    def classify_action(cls, action_name: str, params: Dict[str, Any]) -> ActionCategory:
        """
        Classifies an agent action into Category A, B, or C.
        """
        name = action_name.lower()
        selector = str(params.get("selector", "")).lower()
        text = str(params.get("text", "")).lower()
        url = str(params.get("url", "")).lower()
        value = str(params.get("value", "")).lower()

        combined = f"{name} {selector} {text} {url} {value}"

        # Category C triggers
        for kw in cls.CONSEQUENTIAL_KEYWORDS:
            if kw in combined:
                return ActionCategory.CATEGORY_C
                
        if name in ("submit_form", "place_order", "delete_resource", "confirm_booking"):
            return ActionCategory.CATEGORY_C

        # Category B triggers
        if name in ("upload_file", "enter_credential", "authenticate"):
            return ActionCategory.CATEGORY_B

        for kw in cls.SENSITIVE_KEYWORDS:
            if kw in combined:
                return ActionCategory.CATEGORY_B

        # Default to Category A (Routine)
        return ActionCategory.CATEGORY_A

    @classmethod
    def mask_sensitive_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitizes dictionary values containing passwords, tokens, or personal identifiers
        for safe logging and memory storage.
        """
        masked = {}
        for k, v in data.items():
            k_lower = k.lower()
            if any(secret in k_lower for secret in ("password", "token", "secret", "cvv", "card_number", "ssn")):
                masked[k] = "******** [REDACTED]"
            elif isinstance(v, dict):
                masked[k] = cls.mask_sensitive_data(v)
            else:
                masked[k] = v
        return masked
