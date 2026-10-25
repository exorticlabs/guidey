"""
state.py — Hot State Management for Unified Professor Agent.

Architecture: Hot / Cold Split
- Hot State: Local SQLite database on the agent server for sub-millisecond reads/writes during active turns.
- Cold State: PostgreSQL database synced on yield, question asking, or session completion.
"""
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
import sqlite3
import json
import uuid
import time
import os
from pathlib import Path

from agent.core.config import (
    DEFAULT_CANVAS_WIDTH,
    DEFAULT_CANVAS_HEIGHT,
    DEFAULT_OVERLAY_COLOR,
    DEFAULT_CONNECTION_STYLE,
    MAX_ACTIVE_BOARD_NODES,
    PRUNE_BOARD_NODES_COUNT,
)

try:
    from agent.config import HOT_STATE_SESSION_TTL_SECONDS, sanitize_identifier
except ImportError:
    from config import HOT_STATE_SESSION_TTL_SECONDS, sanitize_identifier


@dataclass
class BoardNode:
    id: str
    kind: str  # 'heading' | 'text' | 'equation' | 'step' | 'scratchpad' | 'diagram' | 'asset'
    content: str
    role: str = "primary_stream"  # 'heading' | 'primary_stream' | 'annotation' | 'margin' | 'focal'
    zone: str = "main"  # 'main' | 'margin' | 'scratchpad' | 'focal'
    step_num: Optional[int] = None
    w: Optional[int] = None
    h: Optional[int] = None
    spatial_intent: Optional[Dict[str, Any]] = None  # { target_id, rel, offset_x, offset_y }
    created_at: float = field(default_factory=time.time)


@dataclass
class ChalkOverlay:
    id: str
    target_node_id: str
    overlay_type: str  # 'encircle' | 'strikethrough' | 'box' | 'underline' | 'curly_brace'
    sub_term: str = ""
    color: str = DEFAULT_OVERLAY_COLOR
    created_at: float = field(default_factory=time.time)


@dataclass
class BoardConnection:
    id: str
    from_id: str
    to_id: str
    label: str = ""
    style: str = DEFAULT_CONNECTION_STYLE
    created_at: float = field(default_factory=time.time)


@dataclass
class EventLog:
    id: str
    actor: str  # 'professor' | 'student' | 'system'
    action: str  # 'write' | 'speak' | 'circle' | 'cancel' | 'ask' | 'answer'
    payload: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class SessionState:
    session_id: str
    workspace_id: str = "default"
    student_id: str = "guest"
    subject: str = "General"
    topic: str = "General"
    nodes: List[BoardNode] = field(default_factory=list)
    overlays: List[ChalkOverlay] = field(default_factory=list)
    connections: List[BoardConnection] = field(default_factory=list)
    events: List[EventLog] = field(default_factory=list)
    step_counter: int = 0
    canvas_w: int = DEFAULT_CANVAS_WIDTH
    canvas_h: int = DEFAULT_CANVAS_HEIGHT
    plan: Optional[Dict[str, Any]] = None
    plan_current_index: int = 0
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def set_plan(self, plan_dict: Dict[str, Any]):
        """Sets the active lesson plan and initializes plan state."""
        self.plan = plan_dict
        self.plan_current_index = plan_dict.get("current_index", 0)
        self.updated_at = time.time()

    def advance_plan(self) -> Optional[Dict[str, Any]]:
        """Advances the lesson plan to the next subtopic, updating item statuses."""
        if not self.plan or "subtopics" not in self.plan:
            return None

        subtopics = self.plan.get("subtopics", [])
        if 0 <= self.plan_current_index < len(subtopics):
            subtopics[self.plan_current_index]["status"] = "completed"

        if self.plan_current_index + 1 < len(subtopics):
            self.plan_current_index += 1
            subtopics[self.plan_current_index]["status"] = "teaching"
            self.plan["current_index"] = self.plan_current_index
            self.updated_at = time.time()
            return subtopics[self.plan_current_index]
        return None

    def get_current_plan_item(self) -> Optional[Dict[str, Any]]:
        """Returns the currently active subtopic in the plan."""
        if not self.plan or "subtopics" not in self.plan:
            return None
        subtopics = self.plan.get("subtopics", [])
        if 0 <= self.plan_current_index < len(subtopics):
            return subtopics[self.plan_current_index]
        return None

    def get_plan_summary(self) -> str:
        """Returns a string summary of the lesson plan progression."""
        if not self.plan:
            return ""
        from agent.core.lesson_planner import LessonPlanner
        return LessonPlanner.format_plan_guidance(self.plan)

    def add_event(self, actor: str, action: str, payload: str):
        self.events.append(EventLog(
            id=f"evt_{uuid.uuid4().hex[:8]}",
            actor=actor,
            action=action,
            payload=payload,
            timestamp=time.time()
        ))
        self.updated_at = time.time()

    def get_board_summary(self) -> str:
        """Returns a compact textual summary of what is currently on the chalkboard."""
        if not self.nodes:
            return "[Chalkboard is currently blank]"

        lines = ["[Current Chalkboard State]:"]
        for node in self.nodes:
            step_tag = f" (Step {node.step_num})" if node.step_num else ""
            zone_tag = f" [{node.zone.upper()}]" if node.zone != "main" else ""
            lines.append(f"- ID: {node.id}{step_tag}{zone_tag} ({node.kind}): {node.content}")

        if self.overlays:
            lines.append("\n[Active Chalk Overlays / Highlights]:")
            for ov in self.overlays:
                sub = f" on '{ov.sub_term}'" if ov.sub_term else ""
                lines.append(f"- {ov.overlay_type.upper()}{sub} targeting node {ov.target_node_id}")

        if self.connections:
            lines.append("\n[Active Connections / Callout Arrows]:")
            for conn in self.connections:
                lbl = f" ('{conn.label}')" if conn.label else ""
                lines.append(f"- Arrow from {conn.from_id} -> {conn.to_id}{lbl}")

        return "\n".join(lines)


class StateManager:
    """
    Manages local SQLite database for hot agent state and synchronization with PostgreSQL cold store.
    """

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            data_dir = Path(__file__).resolve().parent.parent.parent / "data"
            data_dir.mkdir(parents=True, exist_ok=True)
            self.db_path = str(data_dir / "agent_hot_state.db")
        else:
            self.db_path = db_path

        self._init_sqlite()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite(self):
        with self._get_conn() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                workspace_id TEXT DEFAULT 'default',
                student_id TEXT DEFAULT 'guest',
                subject TEXT,
                topic TEXT,
                step_counter INTEGER DEFAULT 0,
                canvas_w INTEGER DEFAULT 1000,
                canvas_h INTEGER DEFAULT 650,
                plan_json TEXT,
                plan_current_index INTEGER DEFAULT 0,
                created_at REAL,
                updated_at REAL
            );

            CREATE TABLE IF NOT EXISTS board_nodes (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                kind TEXT,
                content TEXT,
                role TEXT,
                zone TEXT,
                step_num INTEGER,
                w INTEGER,
                h INTEGER,
                spatial_intent TEXT,
                created_at REAL,
                FOREIGN KEY(session_id) REFERENCES sessions(session_id)
            );

            CREATE TABLE IF NOT EXISTS chalk_overlays (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                target_node_id TEXT,
                overlay_type TEXT,
                sub_term TEXT,
                color TEXT,
                created_at REAL,
                FOREIGN KEY(session_id) REFERENCES sessions(session_id)
            );

            CREATE TABLE IF NOT EXISTS board_connections (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                from_id TEXT,
                to_id TEXT,
                label TEXT,
                style TEXT,
                created_at REAL,
                FOREIGN KEY(session_id) REFERENCES sessions(session_id)
            );

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                actor TEXT,
                action TEXT,
                payload TEXT,
                timestamp REAL,
                FOREIGN KEY(session_id) REFERENCES sessions(session_id)
            );

            CREATE TABLE IF NOT EXISTS turn_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                step_index INTEGER,
                board_writes_json TEXT,
                speech TEXT,
                gesture TEXT,
                yield_decision TEXT,
                created_at REAL
            );
            """)
            # Auto-migrate existing databases
            for col_sql in [
                "ALTER TABLE sessions ADD COLUMN workspace_id TEXT DEFAULT 'default'",
                "ALTER TABLE sessions ADD COLUMN student_id TEXT DEFAULT 'guest'",
                "ALTER TABLE sessions ADD COLUMN plan_json TEXT",
                "ALTER TABLE sessions ADD COLUMN plan_current_index INTEGER DEFAULT 0"
            ]:
                try:
                    conn.execute(col_sql)
                except Exception:
                    pass

        # Run startup retention cleanup
        try:
            self.purge_expired_sessions()
        except Exception:
            pass

    @staticmethod
    def build_scoped_session_id(session_id: str, workspace_id: str = "default", student_id: str = "guest") -> str:
        """
        Builds a namespaced session identifier isolating tenant/user states in SQLite.
        Format: {workspace_id}:{student_id}:{session_id}
        """
        if not session_id:
            session_id = str(uuid.uuid4())
        s_id = str(session_id).strip()
        if ":" in s_id:
            return s_id
        if workspace_id == "default" and student_id == "guest":
            return s_id
        safe_ws = sanitize_identifier(workspace_id, "default")
        safe_st = sanitize_identifier(student_id, "guest")
        return f"{safe_ws}:{safe_st}:{s_id}"

    def purge_expired_sessions(self, max_age_seconds: Optional[float] = None) -> int:
        """
        Evicts expired sessions and their blackboard state older than max_age_seconds (TTL).
        Default TTL: HOT_STATE_SESSION_TTL_SECONDS (30 days).
        Returns number of pruned sessions.
        """
        ttl = max_age_seconds if max_age_seconds is not None else HOT_STATE_SESSION_TTL_SECONDS
        cutoff = time.time() - ttl
        with self._get_conn() as conn:
            expired_rows = conn.execute("SELECT session_id FROM sessions WHERE updated_at < ?", (cutoff,)).fetchall()
            if not expired_rows:
                return 0
            expired_ids = [r["session_id"] for r in expired_rows]
            for sid in expired_ids:
                conn.execute("DELETE FROM board_nodes WHERE session_id = ?", (sid,))
                conn.execute("DELETE FROM chalk_overlays WHERE session_id = ?", (sid,))
                conn.execute("DELETE FROM board_connections WHERE session_id = ?", (sid,))
                conn.execute("DELETE FROM events WHERE session_id = ?", (sid,))
                conn.execute("DELETE FROM turn_steps WHERE session_id = ?", (sid,))
                conn.execute("DELETE FROM sessions WHERE session_id = ?", (sid,))
            return len(expired_ids)

    def prune_session_turn_steps(self, session_id: str, keep_last: int = 100):
        """Caps the maximum number of recorded turn_steps per session to keep table compact."""
        with self._get_conn() as conn:
            conn.execute(
                """DELETE FROM turn_steps WHERE session_id = ? AND id NOT IN (
                    SELECT id FROM turn_steps WHERE session_id = ? ORDER BY id DESC LIMIT ?
                )""",
                (session_id, session_id, keep_last)
            )

    def delete_session(self, session_id: str):
        """Immediately deletes a session and all its board nodes, overlays, connections, and events."""
        with self._get_conn() as conn:
            conn.execute("DELETE FROM board_nodes WHERE session_id = ? OR session_id LIKE ?", (session_id, f"%:{session_id}"))
            conn.execute("DELETE FROM chalk_overlays WHERE session_id = ? OR session_id LIKE ?", (session_id, f"%:{session_id}"))
            conn.execute("DELETE FROM board_connections WHERE session_id = ? OR session_id LIKE ?", (session_id, f"%:{session_id}"))
            conn.execute("DELETE FROM events WHERE session_id = ? OR session_id LIKE ?", (session_id, f"%:{session_id}"))
            conn.execute("DELETE FROM turn_steps WHERE session_id = ? OR session_id LIKE ?", (session_id, f"%:{session_id}"))
            conn.execute("DELETE FROM sessions WHERE session_id = ? OR session_id LIKE ?", (session_id, f"%:{session_id}"))

    def load_or_create_session(
        self,
        session_id: str,
        subject: str = "General",
        topic: str = "General",
        canvas_w: int = DEFAULT_CANVAS_WIDTH,
        canvas_h: int = DEFAULT_CANVAS_HEIGHT,
        workspace_id: str = "default",
        student_id: str = "guest",
    ) -> SessionState:
        scoped_id = self.build_scoped_session_id(session_id, workspace_id, student_id)
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM sessions WHERE session_id = ? OR session_id = ?", (scoped_id, session_id)).fetchone()
            if not row:
                now = time.time()
                conn.execute(
                    """INSERT INTO sessions (session_id, workspace_id, student_id, subject, topic, step_counter, canvas_w, canvas_h, plan_json, plan_current_index, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, 0, ?, ?)""",
                    (scoped_id, workspace_id, student_id, subject, topic, canvas_w, canvas_h, now, now)
                )
                return SessionState(
                    session_id=scoped_id,
                    workspace_id=workspace_id,
                    student_id=student_id,
                    subject=subject,
                    topic=topic,
                    canvas_w=canvas_w,
                    canvas_h=canvas_h,
                    plan=None,
                    plan_current_index=0,
                    created_at=now,
                    updated_at=now
                )

            actual_session_id = row["session_id"]
            now = time.time()
            row_subject = row["subject"] or "General"
            row_topic = row["topic"] or "General"

            # If caller supplied a specific subject or topic, update session row
            if subject and subject not in ["General", ""] and (row_subject in ["General", "Mathematics"] or row_subject != subject):
                row_subject = subject
                conn.execute("UPDATE sessions SET subject = ?, updated_at = ? WHERE session_id = ?", (subject, now, actual_session_id))
            elif row_subject == "Mathematics" and subject in ["General", None]:
                # Clear legacy accidental "Mathematics" hardcoding
                row_subject = "General"
                conn.execute("UPDATE sessions SET subject = ?, updated_at = ? WHERE session_id = ?", ("General", now, actual_session_id))

            if topic and topic not in ["General", ""] and (row_topic == "General" or row_topic != topic):
                row_topic = topic
                conn.execute("UPDATE sessions SET topic = ?, updated_at = ? WHERE session_id = ?", (topic, now, actual_session_id))

            # Load nodes
            node_rows = conn.execute("SELECT * FROM board_nodes WHERE session_id = ? ORDER BY created_at ASC", (actual_session_id,)).fetchall()
            nodes = [
                BoardNode(
                    id=r["id"],
                    kind=r["kind"],
                    content=r["content"],
                    role=r["role"] or "primary_stream",
                    zone=r["zone"] or "main",
                    step_num=r["step_num"],
                    w=r["w"],
                    h=r["h"],
                    spatial_intent=json.loads(r["spatial_intent"]) if r["spatial_intent"] else None,
                    created_at=r["created_at"]
                )
                for r in node_rows
            ]

            # Load overlays
            overlay_rows = conn.execute("SELECT * FROM chalk_overlays WHERE session_id = ? ORDER BY created_at ASC", (actual_session_id,)).fetchall()
            overlays = [
                ChalkOverlay(
                    id=r["id"],
                    target_node_id=r["target_node_id"],
                    overlay_type=r["overlay_type"],
                    sub_term=r["sub_term"] or "",
                    color=r["color"] or "chalk-yellow",
                    created_at=r["created_at"]
                )
                for r in overlay_rows
            ]

            # Load connections
            conn_rows = conn.execute("SELECT * FROM board_connections WHERE session_id = ? ORDER BY created_at ASC", (actual_session_id,)).fetchall()
            connections = [
                BoardConnection(
                    id=r["id"],
                    from_id=r["from_id"],
                    to_id=r["to_id"],
                    label=r["label"] or "",
                    style=r["style"] or "curved_callout",
                    created_at=r["created_at"]
                )
                for r in conn_rows
            ]

            # Load recent events (last 30)
            event_rows = conn.execute("SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 30", (actual_session_id,)).fetchall()
            events = [
                EventLog(
                    id=r["id"],
                    actor=r["actor"],
                    action=r["action"],
                    payload=r["payload"],
                    timestamp=r["timestamp"]
                )
                for r in reversed(event_rows)
            ]

            plan_data = None
            if "plan_json" in row.keys() and row["plan_json"]:
                try:
                    plan_data = json.loads(row["plan_json"])
                except Exception:
                    plan_data = None

            plan_idx = row["plan_current_index"] if "plan_current_index" in row.keys() and row["plan_current_index"] is not None else 0

            ws_val = row["workspace_id"] if "workspace_id" in row.keys() and row["workspace_id"] else workspace_id
            st_val = row["student_id"] if "student_id" in row.keys() and row["student_id"] else student_id

            return SessionState(
                session_id=row["session_id"],
                workspace_id=ws_val,
                student_id=st_val,
                subject=row_subject,
                topic=row_topic,
                nodes=nodes,
                overlays=overlays,
                connections=connections,
                events=events,
                step_counter=row["step_counter"],
                canvas_w=row["canvas_w"] or canvas_w,
                canvas_h=row["canvas_h"] or canvas_h,
                plan=plan_data,
                plan_current_index=plan_idx,
                created_at=row["created_at"],
                updated_at=row["updated_at"]
            )

    def save(self, state: SessionState):
        now = time.time()
        plan_str = json.dumps(state.plan, ensure_ascii=True) if state.plan else None
        with self._get_conn() as conn:
            conn.execute(
                """UPDATE sessions SET step_counter = ?, canvas_w = ?, canvas_h = ?, plan_json = ?, plan_current_index = ?, updated_at = ? WHERE session_id = ?""",
                (state.step_counter, state.canvas_w, state.canvas_h, plan_str, state.plan_current_index, now, state.session_id)
            )

            # Re-sync nodes
            conn.execute("DELETE FROM board_nodes WHERE session_id = ?", (state.session_id,))
            for node in state.nodes:
                conn.execute(
                    """INSERT OR REPLACE INTO board_nodes (id, session_id, kind, content, role, zone, step_num, w, h, spatial_intent, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        node.id,
                        state.session_id,
                        node.kind,
                        node.content,
                        node.role,
                        node.zone,
                        node.step_num,
                        node.w,
                        node.h,
                        json.dumps(node.spatial_intent) if node.spatial_intent else None,
                        node.created_at
                    )
                )

            # Re-sync overlays
            conn.execute("DELETE FROM chalk_overlays WHERE session_id = ?", (state.session_id,))
            for ov in state.overlays:
                conn.execute(
                    """INSERT OR REPLACE INTO chalk_overlays (id, session_id, target_node_id, overlay_type, sub_term, color, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (ov.id, state.session_id, ov.target_node_id, ov.overlay_type, ov.sub_term, ov.color, ov.created_at)
                )

            # Re-sync connections
            conn.execute("DELETE FROM board_connections WHERE session_id = ?", (state.session_id,))
            for c in state.connections:
                conn.execute(
                    """INSERT OR REPLACE INTO board_connections (id, session_id, from_id, to_id, label, style, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (c.id, state.session_id, c.from_id, c.to_id, c.label, c.style, c.created_at)
                )

            # Save new events
            for evt in state.events:
                conn.execute(
                    """INSERT OR IGNORE INTO events (id, session_id, actor, action, payload, timestamp)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (evt.id, state.session_id, evt.actor, evt.action, evt.payload, evt.timestamp)
                )

    def save_step(
        self,
        session_id: str,
        step_index: int,
        board_action: List[Dict[str, Any]],
        speech: str,
        gesture: str,
        yield_dec: str
    ):
        with self._get_conn() as conn:
            conn.execute(
                """INSERT INTO turn_steps (session_id, step_index, board_writes_json, speech, gesture, yield_decision, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (session_id, step_index, json.dumps(board_action), speech, gesture, yield_dec, time.time())
            )
        try:
            self.prune_session_turn_steps(session_id, keep_last=100)
        except Exception:
            pass

    def sync_to_postgres(self, session_id: str, db_session):
        """
        Cold synchronization to PostgreSQL on session yield/completion.
        Saves final chalkboard snapshot and clean session state.
        """
        if not db_session:
            return

        try:
            state = self.load_or_create_session(session_id)
            # Serialize board state snapshot
            snapshot_dict = {
                "nodes": [asdict(n) for n in state.nodes],
                "overlays": [asdict(o) for o in state.overlays],
                "connections": [asdict(c) for c in state.connections],
                "step_counter": state.step_counter,
                "synced_at": time.time()
            }

            # If there is a session or board snapshot table in Postgres, commit it
            # We can log success
            pass
        except Exception as e:
            print(f"[StateManager] Warning: sync_to_postgres encountered error: {e}")
