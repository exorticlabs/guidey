import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.absolute()
MEMORY_DIR = PROJECT_ROOT / "memory"
UPLOAD_DIR = MEMORY_DIR / "uploads"
TEMP_UPLOAD_DIR = MEMORY_DIR / "temp_uploads"
RESEARCH_DIR = MEMORY_DIR / "research"
WORKSPACES_DIR = MEMORY_DIR / "workspaces"

# Create core directories
MEMORY_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
TEMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)

# Default setting parameters
DEFAULT_STUDENT_ID = "solo_learner"
DEFAULT_WORKSPACE = "default"
DEFAULT_MODEL = "gemini"

# Data retention policy: 30 days hot state retention
HOT_STATE_SESSION_TTL_SECONDS = 30 * 86400

import re
from typing import Optional, Any

def sanitize_identifier(name: Any, default: str = "default") -> str:
    """Sanitize user/workspace identifiers to prevent directory traversal attacks."""
    if name is None:
        return default
    sanitized = re.sub(r'[^a-zA-Z0-9_\-]', '_', str(name).strip())
    sanitized = sanitized.strip('._')
    return sanitized or default

def get_safe_workspace_path(workspace_id: Any, student_id: Optional[Any] = None) -> Path:
    """
    Safely resolves and creates a workspace directory path strictly inside WORKSPACES_DIR.
    Enforces strict path containment to prevent directory traversal.
    """
    safe_ws = sanitize_identifier(workspace_id, DEFAULT_WORKSPACE)
    target = WORKSPACES_DIR / safe_ws
    if student_id is not None:
        safe_student = sanitize_identifier(student_id, DEFAULT_STUDENT_ID)
        target = target / safe_student

    resolved = target.resolve()
    workspaces_root = WORKSPACES_DIR.resolve()
    try:
        resolved.relative_to(workspaces_root)
    except ValueError:
        raise ValueError(f"Directory traversal detected for workspace='{workspace_id}', student='{student_id}'")

    target.mkdir(parents=True, exist_ok=True)
    return target
