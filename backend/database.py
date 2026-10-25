import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set. Please set it in .env")

engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_recycle=300
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def recalculate_subject_progress(db, user_id: str, subject_id: int) -> float:
    """
    Calculates the ratio of "completed" topics in a subject for a given user.
    If the subject has no topics, returns 0.0.
    """
    import models
    # Count total topics in this subject
    total_topics = (
        db.query(models.Topic)
        .join(models.Unit)
        .filter(models.Unit.subject_id == subject_id)
        .count()
    )
    if total_topics == 0:
        return 0.0
    
    # Count completed topics by this user in this subject
    completed_topics = (
        db.query(models.UserTopicMapping)
        .join(models.Topic)
        .join(models.Unit)
        .filter(
            models.Unit.subject_id == subject_id,
            models.UserTopicMapping.user_id == user_id,
            models.UserTopicMapping.status == "completed"
        )
        .count()
    )
    return round((completed_topics / total_topics) * 100.0, 1)


def update_user_overall_progress(db, user_id: str):
    """
    Recalculates progress for all subjects the user has access to,
    updates subject.progress if user-specific, and updates user.overall_progress.
    """
    import models
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return
    
    # Fetch all subjects this user has access to, following the same logic as server.py
    if user.org_id is None:
        subjects = db.query(models.Subject).filter(
            models.Subject.org_id == None,
            models.Subject.user_id == user_id
        ).all()
    elif user.role == "student":
        user_groups = db.query(models.UserGroupMapping).filter(models.UserGroupMapping.user_id == user_id).all()
        group_ids = [g.group_id for g in user_groups]
        if not group_ids:
            subjects = []
        else:
            subject_mappings = db.query(models.SubjectGroupMapping).filter(
                models.SubjectGroupMapping.group_id.in_(group_ids)
            ).all()
            subject_ids = [m.subject_id for m in subject_mappings]
            if not subject_ids:
                subjects = []
            else:
                subjects = db.query(models.Subject).filter(
                    models.Subject.id.in_(subject_ids),
                    models.Subject.org_id == user.org_id
                ).all()
    else:
        subjects = db.query(models.Subject).filter(models.Subject.org_id == user.org_id).all()
        
    if not subjects:
        user.overall_progress = 0.0
        db.commit()
        return

    total_progress = 0.0
    for s in subjects:
        prog = recalculate_subject_progress(db, user_id, s.id)
        # Update Subject.progress only if it's user-specific (solo learner subject or has non-None user_id)
        if s.user_id == user_id or s.user_id is not None:
            s.progress = prog
        total_progress += prog
        
    user.overall_progress = round(total_progress / len(subjects), 1)
    db.commit()

