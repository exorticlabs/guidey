import json
import re
from datetime import datetime
import os
import sys

from .utils import now_iso

def get_db():
    backend_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if backend_path not in sys.path:
        sys.path.append(backend_path)
    from database import SessionLocal
    return SessionLocal()

class MemoryManager:
    def __init__(self, student_id: str):
        self.student_id = student_id
        
    def _default_org_memory(self):
        return {
            "identity": {
                "name": "guiedteach",
                "role": "AI teacher",
                "traits": ["helpful", "proactive", "truthful"],
            },
            "knowledge": [],
            "goals": [],
        }

    def _default_group_memory(self):
        return {
            "focus_areas": [],
            "group_knowledge": [],
            "schedule": {}
        }
        
    def _default_student_memory(self):
        return {
            "notes": [],
            "status": {
                "current_task": "",
                "last_reply": "",
                "last_updated": now_iso(),
            },
            "preferences": {}
        }

    def _get_student_context(self, db):
        from models import User, UserGroupMapping
        user = db.query(User).filter_by(id=self.student_id).first()
        if not user:
            return None, None
            
        org_id = user.org_id
        
        # Get the first group mapping for simplicity in this B2B structure
        mapping = db.query(UserGroupMapping).filter_by(user_id=self.student_id).first()
        group_id = mapping.group_id if mapping else None
        
        return org_id, group_id

    def load_memory(self):
        db = get_db()
        try:
            org_id, group_id = self._get_student_context(db)
            
            org_data = self._default_org_memory()
            group_data = self._default_group_memory()
            student_data = self._default_student_memory()
            
            if org_id:
                from models import OrganizationMemory
                org_record = db.query(OrganizationMemory).filter_by(org_id=org_id).first()
                if org_record and org_record.data:
                    org_data.update(org_record.data)
            
            if group_id:
                from models import GroupMemory
                group_record = db.query(GroupMemory).filter_by(group_id=group_id).first()
                if group_record and group_record.data:
                    group_data.update(group_record.data)
                    
            from models import StudentMemory
            student_record = db.query(StudentMemory).filter_by(student_id=self.student_id).first()
            if student_record and student_record.data:
                student_data.update(student_record.data)
                
            return {
                "organization": org_data,
                "group": group_data,
                "student": student_data
            }
        finally:
            db.close()

    def update_student_status(self, current_task: str | None = None, last_reply: str | None = None):
        db = get_db()
        try:
            from models import StudentMemory
            from sqlalchemy.orm.attributes import flag_modified
            
            record = db.query(StudentMemory).filter_by(student_id=self.student_id).first()
            data = dict(record.data) if record and record.data else self._default_student_memory()
            
            status = data.setdefault("status", {})
            if current_task is not None:
                status["current_task"] = current_task
            if last_reply is not None:
                status["last_reply"] = last_reply
            status["last_updated"] = now_iso()
            
            if not record:
                record = StudentMemory(student_id=self.student_id, data=data)
                db.add(record)
            else:
                record.data = data
                record.last_updated = datetime.utcnow()
                flag_modified(record, "data")
            db.commit()
        except Exception as e:
            print(f"Error updating student status: {e}")
        finally:
            db.close()

    def add_student_note(self, text: str, note_type: str = "general"):
        if not text:
            return
        db = get_db()
        try:
            from models import StudentMemory
            from sqlalchemy.orm.attributes import flag_modified
            
            record = db.query(StudentMemory).filter_by(student_id=self.student_id).first()
            data = dict(record.data) if record and record.data else self._default_student_memory()
            
            entry = {"ts": now_iso(), "type": note_type, "text": text.strip()}
            data.setdefault("notes", []).append(entry)
            data["notes"] = data["notes"][-50:]
            
            if not record:
                record = StudentMemory(student_id=self.student_id, data=data)
                db.add(record)
            else:
                record.data = data
                record.last_updated = datetime.utcnow()
                flag_modified(record, "data")
            db.commit()
        except Exception as e:
            print(f"Error adding student note: {e}")
        finally:
            db.close()

    def build_context_prompt(self, max_items: int = 4) -> str:
        memory = self.load_memory()
        org_data = memory.get("organization", {})
        group_data = memory.get("group", {})
        student_data = memory.get("student", {})
        
        identity = org_data.get("identity", {})
        name = identity.get("name", "guiedteach")
        role = identity.get("role", "teacher")
        traits = ", ".join(identity.get("traits", [])[:max_items])
        
        lines = [
            f"Identity: {name} ({role}).",
            f"Traits: {traits or 'helpful, clear'}.",
        ]
        
        org_knowledge = org_data.get("knowledge", [])[:max_items]
        if org_knowledge:
            lines.append("Institution Guidance: " + "; ".join(org_knowledge))
            
        # Keep notes subtle and non-intrusive
        notes = student_data.get("notes", [])[-max_items:]
        if notes:
            note_texts = [n.get("text", "") if isinstance(n, dict) else str(n) for n in notes]
            valid_notes = [n for n in note_texts if n and len(n) < 100]
            if valid_notes:
                lines.append("Learner Preferences (Optional): " + "; ".join(valid_notes))
            
        lines.append("Guidance: Always prioritize the user's current topic. Never force callbacks to past subjects.")
        return "\n".join(lines).strip()
        
    def capture_user_memory(self, user_text: str):
        match = re.match(r"(?i)^(remember|note|memory)[:\s]+(.+)$", user_text.strip())
        if match:
            self.add_student_note(match.group(2), note_type="user")
