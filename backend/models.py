from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, JSON, event
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    current_semester = Column(String)
    active_students = Column(Integer, default=0)
    learning_hours_weekly = Column(Float, default=0.0)
    ai_engagement_percent = Column(Float, default=0.0)
    completion_percent = Column(Float, default=0.0)
    teaching_style = Column(String, default="Friendly")
    is_subscribed = Column(Boolean, default=False)
    usage_limit = Column(Integer, default=1000)
    groups = relationship("OrganizationGroup", back_populates="organization", cascade="all, delete-orphan")

class OrganizationGroup(Base):
    __tablename__ = "organization_groups"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    parent_id = Column(Integer, ForeignKey("organization_groups.id"), nullable=True)
    key = Column(String)    # e.g., "Branch", "Department", "Semester"
    value = Column(String)  # e.g., "Engineering", "CSE", "Sem 5"
    
    organization = relationship("Organization", back_populates="groups")
    children = relationship("OrganizationGroup", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("OrganizationGroup", back_populates="children", remote_side=[id])

class OrganizationMemory(Base):
    __tablename__ = "organization_memory"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), unique=True)
    data = Column(JSON, default=dict)
    last_updated = Column(DateTime, default=datetime.utcnow)
    organization = relationship("Organization")

class GroupMemory(Base):
    __tablename__ = "group_memory"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("organization_groups.id"), unique=True)
    data = Column(JSON, default=dict)
    last_updated = Column(DateTime, default=datetime.utcnow)
    group = relationship("OrganizationGroup")

class StudentMemory(Base):
    __tablename__ = "student_memory"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), unique=True)
    data = Column(JSON, default=dict)
    last_updated = Column(DateTime, default=datetime.utcnow)
    student = relationship("User")

class UserGroupMapping(Base):
    __tablename__ = "user_group_mappings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    group_id = Column(Integer, ForeignKey("organization_groups.id"))

class SubjectGroupMapping(Base):
    __tablename__ = "subject_group_mappings"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    group_id = Column(Integer, ForeignKey("organization_groups.id"))

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    avatar = Column(String, default="U")
    overall_progress = Column(Float, default=0.0)
    learning_hours_this_week = Column(Float, default=0.0)
    topics_completed = Column(Integer, default=0)
    theme_preference = Column(String, default="light")  # 'light' or 'dark'
    preferences = Column(JSON, default=lambda: {
        "learning_style": "Visual",
        "notifications": {"email": True, "push": False},
        "privacy": {"show_profile": True}
    })
    role = Column(String, default="student")  # 'student', 'clg', 'admin', 'teacher'
    status = Column(String, default="active") # 'active', 'deactivated', 'archived'
    tokens = Column(Integer, default=20) # Tokens for AI Tutor usage
    last_token_refresh = Column(DateTime, default=datetime.utcnow, nullable=True)
    referral_code = Column(String, unique=True, index=True, nullable=True)
    referred_by = Column(String, ForeignKey("users.id"), nullable=True)
    staff_profile = relationship("Staff", back_populates="user", uselist=False)

class Staff(Base):
    __tablename__ = "staff"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    user_id = Column(String, ForeignKey("users.id"))
    employee_id = Column(String)
    designation = Column(String)
    join_date = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="staff_profile")

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    code = Column(String, index=True)
    name = Column(String)
    tag = Column(String)
    progress = Column(Float, default=0.0)
    last_opened = Column(DateTime, default=datetime.utcnow)
    active_users = Column(Integer, default=0) # For live analytics
    syllabus_content = Column(String, nullable=True)
    syllabus_url = Column(String, nullable=True)
    share_code = Column(String, unique=True, index=True, nullable=True)
    is_template = Column(Boolean, default=False)
    organization = relationship("Organization")
    units = relationship("Unit", back_populates="subject")


class Unit(Base):
    __tablename__ = "units"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    name = Column(String)
    status = Column(String, default="locked") # completed, active, locked
    subject = relationship("Subject", back_populates="units")
    topics = relationship("Topic", back_populates="unit")

class Topic(Base):
    __tablename__ = "topics"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    unit_id = Column(Integer, ForeignKey("units.id"))
    name = Column(String)
    status = Column(String, default="locked") # completed, active, locked
    mastery_level = Column(Float, default=0.0)
    unit = relationship("Unit", back_populates="topics")

class Weakness(Base):
    __tablename__ = "weaknesses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    concept_name = Column(String)
    needs_practice = Column(Boolean, default=True)

class ChatHistory(Base):
    __tablename__ = "chat_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"))
    role = Column(String) # 'user' or 'ai'
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, default="New Chat")
    category = Column(String, default="free")  # "subject", "topic", "free"
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    
    # Big Topic Stateful Tracking
    is_big_topic = Column(Boolean, default=False)
    agenda = Column(String, nullable=True)  # Stored as JSON string
    current_index = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String)  # 'user' or 'ai'
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    session = relationship("ChatSession", back_populates="messages")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String)
    message = Column(String)
    read = Column(Boolean, default=False)
    category = Column(String, default="general")  # general, assessment, achievement, reminder
    timestamp = Column(DateTime, default=datetime.utcnow)

class AIInsight(Base):
    __tablename__ = "ai_insights"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    rank = Column(Integer)
    bottleneck_name = Column(String)

class ClassGroup(Base):
    __tablename__ = 'class_groups'
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    teacher_id = Column(String, ForeignKey('users.id'))
    subject_id = Column(Integer, ForeignKey('subjects.id'))
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    students = relationship('StudentClass', back_populates='class_group')
    syllabuses = relationship('Syllabus', back_populates='class_group')

class StudentClass(Base):
    __tablename__ = 'student_classes'
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey('class_groups.id'))
    student_id = Column(String, ForeignKey('users.id'))
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    class_group = relationship('ClassGroup', back_populates='students')

class Syllabus(Base):
    __tablename__ = 'syllabuses'
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey('class_groups.id'))
    title = Column(String)
    content = Column(String)
    file_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    class_group = relationship('ClassGroup', back_populates='syllabuses')

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, default="New Project")
    description = Column(String, nullable=True)
    status = Column(String, default="Planning")  # Planning, In Progress, Review, Completed
    progress_percent = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    messages = relationship("ProjectMessage", back_populates="project", cascade="all, delete-orphan")

class ProjectMessage(Base):
    __tablename__ = "project_messages"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    role = Column(String)  # 'user' or 'ai'
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    project = relationship("Project", back_populates="messages")

class Announcement(Base):
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    author_id = Column(String, ForeignKey("users.id"))
    title = Column(String)
    content = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    author = relationship("User")
    organization = relationship("Organization")

class UserTopicMapping(Base):
    __tablename__ = "user_topic_mappings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"))
    mastery_level = Column(Float, default=0.0)
    status = Column(String, default="locked") # completed, active, locked
    
    user = relationship("User")
    topic = relationship("Topic")


class GuestDevice(Base):
    __tablename__ = "guest_devices"
    device_id = Column(String, primary_key=True, index=True)
    credits = Column(Integer, default=10)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



def _has_nul_bytes(val):
    if isinstance(val, str):
        return "\x00" in val
    elif isinstance(val, dict):
        return any(_has_nul_bytes(k) or _has_nul_bytes(v) for k, v in val.items())
    elif isinstance(val, list):
        return any(_has_nul_bytes(item) for item in val)
    return False

def _clean_nul_bytes(val):
    if isinstance(val, str):
        return val.replace("\x00", "")
    elif isinstance(val, dict):
        return {_clean_nul_bytes(k): _clean_nul_bytes(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [_clean_nul_bytes(item) for item in val]
    return val

@event.listens_for(Base, "before_insert", propagate=True)
@event.listens_for(Base, "before_update", propagate=True)
def strip_nul_bytes(mapper, connection, target):
    for column in mapper.columns:
        if hasattr(target, column.key):
            val = getattr(target, column.key)
            if isinstance(val, str):
                if "\x00" in val:
                    setattr(target, column.key, val.replace("\x00", ""))
            elif isinstance(val, (dict, list)):
                if _has_nul_bytes(val):
                    setattr(target, column.key, _clean_nul_bytes(val))


