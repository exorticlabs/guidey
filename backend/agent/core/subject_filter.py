"""
Subject Context Filter — Soft algorithmic subject/topic resolution.

Uses a two-tier approach:
  Tier 1: Direct DB resolution (when session already has subject/topic context)
  Tier 2: LLM-based intent classification + resolution (for ambiguous messages)

Handles any user phrasing — no hardcoded pattern matching.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class ResolvedContext:
    """Result of subject/topic resolution."""
    intent: str  # ENUMERATE, CONTINUE_LAST, ORDINAL, TOPIC_REFERENCE, DIRECT, META_QUERY, NONE
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    topic_id: Optional[int] = None
    topic_name: Optional[str] = None
    context_block: str = ""       # Formatted text to inject into prompt
    inject_mode: str = "NONE"     # COMPACT_LIST, TOPIC_DETAIL, SUBJECT_FULL, NONE
    confidence: float = 1.0
    meta_response: Optional[str] = None  # For META_QUERY: pre-built answer

    def has_subject(self) -> bool:
        return self.subject_id is not None

    def has_topic(self) -> bool:
        return self.topic_id is not None


# ── Subject Context Resolver ────────────────────────────────────────────

class SubjectContextResolver:
    """
    Resolves which subject/topic the user is referring to using soft
    algorithmic logic (LLM classification + DB lookups).
    """

    # ── Public API ──────────────────────────────────────────────────

    def resolve(
        self,
        user_message: str,
        user_id: str,
        session: Any,  # ChatSession ORM object or dict
        db: Any,        # SQLAlchemy Session
    ) -> ResolvedContext:
        """
        Main resolution entry point.

        Tier 1: If session already has subject/topic context, use it directly.
        Tier 2: If not, classify intent via LLM and resolve.
        """
        # Tier 1: Direct resolution — session has explicit context
        if not self._needs_classification(session, user_message):
            return self._resolve_direct(session, db)

        # Tier 2: Zero-LLM Semantic Vector Matching & fallback LLM classification
        try:
            subjects_compact = self._load_user_subjects_compact(user_id, db)
            if not subjects_compact:
                return ResolvedContext(intent="NONE")

            # First attempt: Sub-millisecond Semantic Matcher
            from agent.core.semantic_similarity import SemanticSubjectMatcher
            user_catalog = {}
            subj_id_map = {}
            for s in subjects_compact:
                s_name = s.get("name", "")
                t_list = [t.get("title", "") if isinstance(t, dict) else str(t) for t in s.get("topics", [])]
                user_catalog[s_name] = t_list
                subj_id_map[s_name] = s.get("id")

            if user_catalog:
                matcher = SemanticSubjectMatcher(subjects_catalog=user_catalog)
                sem_res = matcher.resolve_subject(user_message, confidence_threshold=0.45)
                if sem_res.is_confident and sem_res.subject in subj_id_map:
                    matched_topic = sem_res.matched_topics[0] if sem_res.matched_topics else None
                    return self._resolve_from_classification(
                        {
                            "intent": "DIRECT",
                            "resolved_subject_id": subj_id_map[sem_res.subject],
                            "resolved_subject_name": sem_res.subject,
                            "resolved_topic_name": matched_topic,
                            "confidence": sem_res.confidence
                        },
                        subjects_compact, db, user_id
                    )

            session_context = self._build_session_context(session, db)
            classification = self._classify_intent(
                user_message, subjects_compact, session_context
            )
            return self._resolve_from_classification(
                classification, subjects_compact, db, user_id
            )
        except Exception as e:
            print(f"[SubjectFilter] Classification error: {e}")
            # Fall back to direct resolution
            return self._resolve_direct(session, db)

    # ── Tier 1: Direct Resolution ───────────────────────────────────

    def _needs_classification(self, session: Any, user_message: str) -> bool:
        """
        Determine if we need LLM classification or can resolve directly.
        Returns False (skip classification) when the session already has
        clear subject/topic context and the message doesn't seem to be
        referencing a different subject.
        """
        if session is None:
            return True

        # Get session attributes safely
        session_subject_id = getattr(session, "subject_id", None)
        session_topic_id = getattr(session, "topic_id", None)
        session_category = getattr(session, "category", "free")

        # If session has no subject context, we need classification
        if not session_subject_id and not session_topic_id:
            return True

        # If session has context AND the message is conversational (not
        # referencing other subjects), skip classification
        # Use a lightweight check — if the message is short and
        # conversational, it's likely about the current topic
        msg = user_message.strip().lower() if user_message else ""

        # Signals that the user might be referencing a DIFFERENT subject
        switch_signals = [
            "subject", "switch", "change to", "go to", "open",
            "another", "different", "all my", "list", "how many",
            "first", "second", "third", "last", "previous", "next subject",
            "back to", "other"
        ]

        for signal in switch_signals:
            if signal in msg:
                return True

        return False

    def _resolve_direct(self, session: Any, db: Any) -> ResolvedContext:
        """Resolve from existing session context — no LLM needed."""
        subject_id = getattr(session, "subject_id", None)
        topic_id = getattr(session, "topic_id", None)

        if not subject_id and not topic_id:
            return ResolvedContext(intent="DIRECT")

        subject_name = None
        topic_name = None
        context_parts = []

        if subject_id:
            try:
                from models import Subject
                sub = db.query(Subject).filter(Subject.id == subject_id).first()
                if sub:
                    subject_name = sub.name
                    context_parts.append(f"Subject: {sub.name} ({sub.code})")
            except Exception:
                pass

        if topic_id:
            try:
                from models import Topic
                top = db.query(Topic).filter(Topic.id == topic_id).first()
                if top:
                    topic_name = top.name
                    context_parts.append(f"Current Topic: {top.name}")
            except Exception:
                pass

        return ResolvedContext(
            intent="DIRECT",
            subject_id=subject_id,
            subject_name=subject_name,
            topic_id=topic_id,
            topic_name=topic_name,
            context_block="\n".join(context_parts) if context_parts else "",
            inject_mode="TOPIC_DETAIL" if topic_id else "SUBJECT_FULL",
            confidence=1.0,
        )

    # ── Tier 2: LLM Classification ─────────────────────────────────

    def _classify_intent(
        self,
        user_message: str,
        subjects_compact: List[dict],
        session_context: dict,
    ) -> dict:
        """
        Call the LLM to classify user intent and resolve subject reference.
        This is the soft algorithmic core — the LLM handles any phrasing.
        """
        from .brain.llm_cloud import run_llm

        subjects_text = json.dumps(subjects_compact, indent=2)
        context_text = json.dumps(session_context, indent=2)

        system_prompt = """\
You are a subject/topic intent classifier for an AI tutoring platform.

Given:
- The student's available subjects (with IDs, names, codes, and topics)
- The current session context (active subject, last activity)
- The student's message

Classify the intent and resolve any subject/topic references.

INTENT TYPES:
- ENUMERATE: Student wants to see/list/count their subjects ("what subjects do I have", "show my courses", "how many subjects")
- CONTINUE_LAST: Student wants to continue where they left off ("continue", "where were we", "last subject", "resume")
- ORDINAL: Student references by position ("first subject", "third topic", "the second one")
- TOPIC_REFERENCE: Student mentions a topic/concept that belongs to a specific subject ("teach me vectors", "explain thermodynamics", "derivatives")
- META_QUERY: Student asks about their progress/stats ("how's my progress", "which subjects am I weak in")
- DIRECT: Message is about the currently active subject/topic (normal continuation)
- NONE: Cannot determine any subject reference

Respond ONLY with a JSON object:
{
    "intent": "INTENT_TYPE",
    "resolved_subject_id": <int or null>,
    "resolved_subject_name": "<string or null>",
    "resolved_topic_name": "<string or null — if a specific topic was mentioned>",
    "confidence": <0.0-1.0>,
    "reasoning": "<one sentence explaining resolution>"
}"""

        prompt = f"""\
Student's subjects:
{subjects_text}

Current session context:
{context_text}

Student's message: "{user_message}"

Classify and resolve."""

        response = run_llm(prompt, system_prompt=system_prompt)

        # Parse response
        return self._parse_classification(response)

    def _parse_classification(self, response: Any) -> dict:
        """Parse the LLM classification response into a dict."""
        fallback = {"intent": "NONE", "confidence": 0.0}

        raw = ""
        if isinstance(response, dict):
            raw = response.get("content", "")
        elif isinstance(response, str):
            raw = response

        if not raw or raw.startswith("["):
            return fallback

        # Clean markdown fencing
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
            cleaned = re.sub(r"\n```$", "", cleaned)
            cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except Exception:
            # Try extracting JSON object
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass
        return fallback

    def _resolve_from_classification(
        self,
        classification: dict,
        subjects_compact: List[dict],
        db: Any,
        user_id: str,
    ) -> ResolvedContext:
        """Convert the LLM classification into a ResolvedContext."""
        intent = classification.get("intent", "NONE")
        subject_id = classification.get("resolved_subject_id")
        subject_name = classification.get("resolved_subject_name")
        topic_name = classification.get("resolved_topic_name")
        confidence = classification.get("confidence", 0.5)

        # ── ENUMERATE: Return compact list ──
        if intent == "ENUMERATE":
            list_lines = []
            for i, s in enumerate(subjects_compact, 1):
                progress = s.get("progress", 0)
                list_lines.append(
                    f"{i}. {s['name']} ({s['code']}) — {progress:.0f}% complete"
                )
            context_block = (
                f"You have {len(subjects_compact)} subjects:\n"
                + "\n".join(list_lines)
            )
            return ResolvedContext(
                intent="ENUMERATE",
                context_block=context_block,
                inject_mode="COMPACT_LIST",
                confidence=confidence,
            )

        # ── META_QUERY: Build stats response ──
        if intent == "META_QUERY":
            stats_lines = []
            for s in subjects_compact:
                progress = s.get("progress", 0)
                topics_count = len(s.get("topics", []))
                stats_lines.append(
                    f"- {s['name']}: {progress:.0f}% ({topics_count} topics)"
                )
            context_block = (
                "Student's subject progress:\n" + "\n".join(stats_lines)
            )
            return ResolvedContext(
                intent="META_QUERY",
                context_block=context_block,
                inject_mode="COMPACT_LIST",
                confidence=confidence,
            )

        # ── CONTINUE_LAST: Resolve from most recent session ──
        if intent == "CONTINUE_LAST":
            return self._resolve_last_active(db, user_id, confidence)

        # ── ORDINAL: Resolve by position ──
        if intent == "ORDINAL" and subject_name:
            # LLM already resolved which subject — find it
            for s in subjects_compact:
                if s["name"].lower() == subject_name.lower():
                    subject_id = s["id"]
                    break

        # ── TOPIC_REFERENCE / DIRECT / ORDINAL: Resolve subject + topic ──
        if subject_id:
            return self._resolve_subject_detail(
                db, subject_id, topic_name, intent, confidence
            )

        # ── Fallback: No resolution ──
        return ResolvedContext(intent=intent, confidence=confidence)

    # ── Helper Methods ──────────────────────────────────────────────

    def _load_user_subjects_compact(
        self, user_id: str, db: Any
    ) -> List[dict]:
        """
        Load a compact representation of the user's subjects.
        Only id, name, code, progress, and topic names — NOT full syllabus.
        """
        try:
            from models import (
                Subject, Unit, Topic, User,
                SubjectGroupMapping, UserGroupMapping
            )

            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return []

            # Determine which subjects the user has access to
            if user.org_id is None:
                subjects = db.query(Subject).filter(
                    Subject.org_id == None,
                    Subject.user_id == user_id,
                ).all()
            elif user.role == "student":
                user_groups = db.query(UserGroupMapping).filter(
                    UserGroupMapping.user_id == user_id
                ).all()
                group_ids = [g.group_id for g in user_groups]
                if not group_ids:
                    return []
                mappings = db.query(SubjectGroupMapping).filter(
                    SubjectGroupMapping.group_id.in_(group_ids)
                ).all()
                subject_ids = [m.subject_id for m in mappings]
                if not subject_ids:
                    return []
                subjects = db.query(Subject).filter(
                    Subject.id.in_(subject_ids)
                ).all()
            else:
                subjects = db.query(Subject).filter(
                    Subject.org_id == user.org_id
                ).all()

            result = []
            for sub in subjects:
                # Get topic names (compact — just names, no descriptions)
                topics = []
                units = db.query(Unit).filter(Unit.subject_id == sub.id).all()
                for u in units:
                    unit_topics = db.query(Topic).filter(
                        Topic.unit_id == u.id
                    ).all()
                    topics.extend([t.name for t in unit_topics])

                result.append({
                    "id": sub.id,
                    "name": sub.name,
                    "code": sub.code or "",
                    "progress": sub.progress or 0.0,
                    "topics": topics[:20],  # Cap at 20 topic names
                })
            return result
        except Exception as e:
            print(f"[SubjectFilter] Error loading subjects: {e}")
            return []

    def _build_session_context(self, session: Any, db: Any) -> dict:
        """Build a compact session context dict for the classifier."""
        ctx = {
            "active_subject_id": None,
            "active_subject_name": None,
            "active_topic_id": None,
            "active_topic_name": None,
            "session_category": "free",
        }

        if session is None:
            return ctx

        ctx["session_category"] = getattr(session, "category", "free")
        ctx["active_subject_id"] = getattr(session, "subject_id", None)
        ctx["active_topic_id"] = getattr(session, "topic_id", None)

        if ctx["active_subject_id"]:
            try:
                from models import Subject
                sub = db.query(Subject).filter(
                    Subject.id == ctx["active_subject_id"]
                ).first()
                if sub:
                    ctx["active_subject_name"] = sub.name
            except Exception:
                pass

        if ctx["active_topic_id"]:
            try:
                from models import Topic
                top = db.query(Topic).filter(
                    Topic.id == ctx["active_topic_id"]
                ).first()
                if top:
                    ctx["active_topic_name"] = top.name
            except Exception:
                pass

        return ctx

    def _resolve_last_active(
        self, db: Any, user_id: str, confidence: float
    ) -> ResolvedContext:
        """Resolve 'continue last' by finding the most recently active session."""
        try:
            from models import ChatSession, Subject, Topic

            last_session = (
                db.query(ChatSession)
                .filter(
                    ChatSession.user_id == user_id,
                    ChatSession.subject_id != None,
                )
                .order_by(ChatSession.updated_at.desc())
                .first()
            )
            if last_session and last_session.subject_id:
                return self._resolve_subject_detail(
                    db, last_session.subject_id,
                    None, "CONTINUE_LAST", confidence,
                )
        except Exception as e:
            print(f"[SubjectFilter] Error resolving last active: {e}")

        return ResolvedContext(intent="CONTINUE_LAST", confidence=confidence)

    def _resolve_subject_detail(
        self,
        db: Any,
        subject_id: int,
        topic_name: Optional[str],
        intent: str,
        confidence: float,
    ) -> ResolvedContext:
        """Build a detailed context block for a resolved subject."""
        try:
            from models import Subject, Unit, Topic

            sub = db.query(Subject).filter(Subject.id == subject_id).first()
            if not sub:
                return ResolvedContext(intent=intent, confidence=confidence)

            context_parts = [f"Subject: {sub.name} ({sub.code or 'N/A'})"]

            # Find the specific topic if referenced
            resolved_topic_id = None
            resolved_topic_name = None
            if topic_name:
                units = db.query(Unit).filter(Unit.subject_id == sub.id).all()
                for u in units:
                    topics = db.query(Topic).filter(Topic.unit_id == u.id).all()
                    for t in topics:
                        if topic_name.lower() in t.name.lower():
                            resolved_topic_id = t.id
                            resolved_topic_name = t.name
                            context_parts.append(f"Resolved Topic: {t.name}")
                            break
                    if resolved_topic_id:
                        break

            # Add topic list (compact)
            units = db.query(Unit).filter(Unit.subject_id == sub.id).all()
            if units:
                topic_names = []
                for u in units:
                    topics = db.query(Topic).filter(Topic.unit_id == u.id).all()
                    topic_names.extend([t.name for t in topics])
                if topic_names:
                    context_parts.append(
                        f"Topics in this subject: {', '.join(topic_names[:15])}"
                    )

            return ResolvedContext(
                intent=intent,
                subject_id=subject_id,
                subject_name=sub.name,
                topic_id=resolved_topic_id,
                topic_name=resolved_topic_name,
                context_block="\n".join(context_parts),
                inject_mode="TOPIC_DETAIL" if resolved_topic_id else "SUBJECT_FULL",
                confidence=confidence,
            )
        except Exception as e:
            print(f"[SubjectFilter] Error resolving subject detail: {e}")
            return ResolvedContext(
                intent=intent, subject_id=subject_id, confidence=confidence
            )
