import sys
import time
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend and agent directories are in path
backend_dir = Path(__file__).resolve().parent.parent
agent_dir = backend_dir / "agent"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(agent_dir))

from agent.config import WORKSPACES_DIR, UPLOAD_DIR, get_safe_workspace_path, sanitize_identifier, HOT_STATE_SESSION_TTL_SECONDS
from agent.core.state import StateManager, SessionState, BoardNode


def test_workspace_path_isolation():
    """Verify get_safe_workspace_path sanitizes traversal attempts and enforces containment."""
    # 1. Attempt path traversal
    safe_dir = get_safe_workspace_path("../../evil_dir", "../evil_student")
    assert safe_dir.exists()
    assert str(safe_dir.resolve()).startswith(str(WORKSPACES_DIR.resolve()))
    assert ".." not in safe_dir.name
    
    # 2. Legitimate workspace
    legit_dir = get_safe_workspace_path("engineering_ws", "student_42")
    assert legit_dir.exists()
    assert str(legit_dir.resolve()).startswith(str(WORKSPACES_DIR.resolve()))
    assert legit_dir.name == "student_42"
    assert legit_dir.parent.name == "engineering_ws"
    print("[PASS] Workspace Path Isolation verified.")


def test_sqlite_hot_state_tenant_isolation():
    """Verify two distinct tenants using identical session_ids do NOT collide in SQLite."""
    sm = StateManager()
    shared_id = f"shared_session_{uuid.uuid4().hex[:8]}"
    node_id = f"node_a_{uuid.uuid4().hex[:8]}"
    
    # Tenant A
    state_a = sm.load_or_create_session(
        session_id=shared_id,
        workspace_id="tenant_a",
        student_id="alice"
    )
    state_a.nodes.append(BoardNode(id=node_id, kind="heading", content="Alice Physics Notes"))
    sm.save(state_a)
    
    # Tenant B with identical session_id
    state_b = sm.load_or_create_session(
        session_id=shared_id,
        workspace_id="tenant_b",
        student_id="bob"
    )
    
    # Assert Bob's state has 0 nodes and is completely isolated from Alice
    assert len(state_b.nodes) == 0
    assert state_a.session_id != state_b.session_id
    assert "tenant_a:alice" in state_a.session_id
    assert "tenant_b:bob" in state_b.session_id
    
    # Re-fetch Alice and verify her node is intact
    re_state_a = sm.load_or_create_session(
        session_id=shared_id,
        workspace_id="tenant_a",
        student_id="alice"
    )
    assert len(re_state_a.nodes) == 1
    assert re_state_a.nodes[0].content == "Alice Physics Notes"
    print("[PASS] SQLite Hot State Tenant Isolation verified.")


def test_hot_state_ttl_retention_and_pruning():
    """Verify TTL eviction purges expired sessions and turn steps are capped."""
    sm = StateManager()
    
    # Create an active session and an artificially expired session
    active_id = f"test_active_{uuid.uuid4().hex[:8]}"
    expired_id = f"test_expired_{uuid.uuid4().hex[:8]}"
    
    sm.load_or_create_session(active_id)
    sm.load_or_create_session(expired_id)
    
    # Artificially set expired session's updated_at to 40 days ago
    forty_days_ago = time.time() - (40 * 86400)
    with sm._get_conn() as conn:
        conn.execute("UPDATE sessions SET updated_at = ? WHERE session_id = ?", (forty_days_ago, expired_id))
    
    # Run purge with default TTL (30 days)
    purged_count = sm.purge_expired_sessions(max_age_seconds=30 * 86400)
    assert purged_count >= 1
    
    # Verify expired session is gone from SQLite
    with sm._get_conn() as conn:
        exp_row = conn.execute("SELECT * FROM sessions WHERE session_id = ?", (expired_id,)).fetchone()
        assert exp_row is None
        # Verify active session is preserved
        act_row = conn.execute("SELECT * FROM sessions WHERE session_id = ?", (active_id,)).fetchone()
        assert act_row is not None
        
    # Test turn step capping
    for i in range(120):
        sm.save_step(active_id, step_index=i, board_action=[], speech=f"Step {i}", gesture="explain", yield_dec="continue")
        
    with sm._get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM turn_steps WHERE session_id = ?", (active_id,)).fetchone()["c"]
        assert count <= 100
        
    print("[PASS] Hot State Retention TTL and turn step pruning verified.")


def test_upload_file_isolation():
    """Verify uploaded filenames are isolated with UUIDs and cannot escape upload directory."""
    raw_filename = "../../dangerous_file.pdf"
    clean_name = Path(raw_filename).name
    assert clean_name == "dangerous_file.pdf"
    
    safe_ws = sanitize_identifier("org/dept-1", "default")
    isolated_filename = f"{safe_ws}_{uuid.uuid4().hex[:12]}_{clean_name}"
    dest_path = (UPLOAD_DIR / isolated_filename).resolve()
    
    # Check that dest_path is contained within UPLOAD_DIR
    assert dest_path.is_relative_to(UPLOAD_DIR.resolve())
    assert ".." not in str(dest_path)
    print("[PASS] Upload File Isolation verified.")


def test_websocket_auth_helper():
    """Verify authenticate_token_string validates tokens and rejects invalid ones."""
    from server import authenticate_token_string
    mock_db = MagicMock()
    
    # None or empty token
    assert authenticate_token_string(None, mock_db) is None
    assert authenticate_token_string("", mock_db) is None
    
    # Invalid token causing exception
    with patch("server.supabase_client.auth.get_user", side_effect=Exception("Invalid JWT")):
        assert authenticate_token_string("bad_token_123", mock_db) is None
        
    print("[PASS] WebSocket Auth Helper verified.")


if __name__ == "__main__":
    test_workspace_path_isolation()
    test_sqlite_hot_state_tenant_isolation()
    test_hot_state_ttl_retention_and_pruning()
    test_upload_file_isolation()
    test_websocket_auth_helper()
    print("\nALL DATA MANAGEMENT & SECURITY TESTS PASSED!")
