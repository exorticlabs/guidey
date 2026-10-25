import sys
import os
import asyncio
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# Add agent directory to sys.path
AGENT_DIR = Path(__file__).parent / "agent"
sys.path.insert(0, str(AGENT_DIR))

# Import agent managers and models
from skills.curriculum import CurriculumManager
from skills.research import ResearchManager
from skills.teaching import TutorManager, ProjectMentorManager
from skills.evaluation import EvaluationManager
from skills.animation import AnimationManager

class ChatRequest(BaseModel):
    topic_id: str
    student_message: str
    workspace_id: str = "default"
    student_id: Optional[str] = None

class DynamicResearchRequest(BaseModel):
    query: str

from database import engine, Base, get_db, recalculate_subject_progress, update_user_overall_progress
import models
from sqlalchemy.orm import Session
from datetime import datetime, timedelta


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
security = HTTPBearer(auto_error=False)

def sanitize_postgres_string(val: Optional[str]) -> Optional[str]:
    if val is None:
        return None
    return val.replace("\x00", "")

def parse_topic_id(val: Any) -> Optional[int]:
    if val is None:
        return None
    val_str = str(val).strip()
    if val_str.isdigit():
        return int(val_str)
    for prefix in ["topic_", "t_"]:
        if val_str.startswith(prefix):
            try:
                return int(val_str[len(prefix):])
            except ValueError:
                pass
    return None

def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)):
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication credentials missing")


    token = credentials.credentials
    try:
        user_res = supabase_client.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth error: {str(e)}")

    import secrets
    import string

    def generate_referral_code():
        alphabet = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(8))

    user = db.query(models.User).filter(models.User.id == user_res.user.id).first()
    if not user:
         # Fallback to email if user was created by admin
         user = db.query(models.User).filter(models.User.email == user_res.user.email).first() if user_res.user.email else None
         if not user:
             # Auto-sync user from Supabase if not in local DB
             metadata = user_res.user.user_metadata or {}
             
             # Process Referral
             referral_code_used = metadata.get("referral_code")
             referrer = None
             starting_tokens = 20 # Solo learner gets 20 credits on base
             
             if referral_code_used:
                 referrer = db.query(models.User).filter(models.User.referral_code == referral_code_used).first()
                 if referrer:
                     starting_tokens = 20 + 10 # 20 base + 10 referral
                     referrer.tokens = (referrer.tokens or 0) + 15 # referred user gets 15
             
             user = models.User(
                 id=user_res.user.id,
                 email=user_res.user.email,
                 name=metadata.get("name", user_res.user.email.split("@")[0] if user_res.user.email else "User"),
                 role=metadata.get("role", "student"),
                 avatar=metadata.get("name", "U")[0].upper(),
                 tokens=starting_tokens,
                 last_token_refresh=datetime.utcnow(),
                 referral_code=generate_referral_code(),
                 referred_by=referrer.id if referrer else None
             )
             db.add(user)
             db.commit()
             db.refresh(user)
    else:
        # Check if monthly renewal is due (every 30 days)
        if user.last_token_refresh is None:
            user.last_token_refresh = datetime.utcnow()
            db.commit()
        elif datetime.utcnow() - user.last_token_refresh.replace(tzinfo=None) > timedelta(days=30):
            # Solo learner (org_id is None) gets 20 credits renewal
            if user.org_id is None:
                user.tokens = (user.tokens or 0) + 20
                user.last_token_refresh = datetime.utcnow()
                db.commit()

    return user

def authenticate_token_string(token: Optional[str], db: Session) -> Optional[models.User]:
    """Validates a raw auth token string and returns the associated models.User if valid."""
    if not token:
        return None
    try:
        user_res = supabase_client.auth.get_user(token)
        if not user_res or not user_res.user:
            return None
        user = db.query(models.User).filter(models.User.id == user_res.user.id).first()
        if not user and user_res.user.email:
            user = db.query(models.User).filter(models.User.email == user_res.user.email).first()
        return user
    except Exception:
        return None

app = FastAPI(title="guiEDTeach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
def start_cleanup_scheduler():
    import threading
    import time
    import shutil
    from datetime import datetime, timedelta
    
    def cleanup_temp_files():
        temp_dir = os.path.join("agent", "memory", "temp_uploads")
        if not os.path.exists(temp_dir):
            return
        cutoff = datetime.now() - timedelta(days=2) # 2 days
        for filename in os.listdir(temp_dir):
            file_path = os.path.join(temp_dir, filename)
            if os.path.isfile(file_path):
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                if file_time < cutoff:
                    try:
                        os.remove(file_path)
                        print(f"[Cleanup] Deleted temp file: {filename}")
                    except Exception as e:
                        print(f"[Cleanup] Failed to delete temp file {file_path}: {e}")
            elif os.path.isdir(file_path):
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                if file_time < cutoff:
                    try:
                        shutil.rmtree(file_path)
                        print(f"[Cleanup] Deleted temp directory: {filename}")
                    except Exception as e:
                        print(f"[Cleanup] Failed to delete temp directory {file_path}: {e}")

    def run():
        time.sleep(30)
        while True:
            try:
                cleanup_temp_files()
            except Exception as e:
                print(f"Error in cleanup scheduler: {e}")
            time.sleep(3600) # run every hour
            
    t = threading.Thread(target=run, daemon=True)
    t.start()

def migrate_and_seed_db():
    from sqlalchemy import text
    from database import SessionLocal
    import models
    
    # 1. Migrate subjects table columns if they do not exist
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT * FROM subjects LIMIT 1"))
            keys = res.keys()
            if "share_code" not in keys:
                print("Adding column share_code to subjects table...")
                conn.execute(text("ALTER TABLE subjects ADD COLUMN share_code VARCHAR(255) UNIQUE"))
            if "is_template" not in keys:
                print("Adding column is_template to subjects table...")
                conn.execute(text("ALTER TABLE subjects ADD COLUMN is_template BOOLEAN DEFAULT FALSE"))
            conn.commit()
    except Exception as e:
        print(f"Migration error (ignore if already added or SQLite): {e}")

    # 2. Seed default templates
    try:
        db = SessionLocal()
        template_count = db.query(models.Subject).filter(models.Subject.is_template == True).count()
        if template_count == 0:
            print("Seeding default subject templates...")
            DEFAULT_TEMPLATES = [
                {
                    "code": "SSC-SCI",
                    "name": "SSC Board - Science & Technology",
                    "tag": "SSC Board",
                    "syllabus": "1. Gravitation\n2. Periodic Classification of Elements\n3. Chemical Reactions and Equations\n4. Effect of Electric Current\n5. Heat\n6. Refraction of Light\n7. Lenses\n8. Metallurgy\n9. Carbon Compounds\n10. Space Missions",
                    "topics": [
                        {"name": "Gravitation", "prereqs": []},
                        {"name": "Periodic Classification of Elements", "prereqs": []},
                        {"name": "Chemical Reactions and Equations", "prereqs": []},
                        {"name": "Effect of Electric Current", "prereqs": []},
                        {"name": "Heat", "prereqs": []},
                        {"name": "Refraction of Light", "prereqs": []},
                        {"name": "Lenses", "prereqs": []},
                        {"name": "Metallurgy", "prereqs": []},
                        {"name": "Carbon Compounds", "prereqs": []},
                        {"name": "Space Missions", "prereqs": []}
                    ]
                },
                {
                    "code": "JEE-MAIN-PHY",
                    "name": "JEE Mains - Physics",
                    "tag": "JEE Mains",
                    "syllabus": "1. Kinematics\n2. Laws of Motion\n3. Work, Energy and Power\n4. Rotational Motion\n5. Gravitation\n6. Thermodynamics\n7. Electrostatics\n8. Current Electricity\n9. Optics\n10. Modern Physics",
                    "topics": [
                        {"name": "Kinematics", "prereqs": []},
                        {"name": "Laws of Motion", "prereqs": ["Kinematics"]},
                        {"name": "Work, Energy and Power", "prereqs": ["Laws of Motion"]},
                        {"name": "Rotational Motion", "prereqs": ["Work, Energy and Power"]},
                        {"name": "Gravitation", "prereqs": ["Laws of Motion"]},
                        {"name": "Thermodynamics", "prereqs": []},
                        {"name": "Electrostatics", "prereqs": []},
                        {"name": "Current Electricity", "prereqs": ["Electrostatics"]},
                        {"name": "Optics", "prereqs": []},
                        {"name": "Modern Physics", "prereqs": []}
                    ]
                },
                {
                    "code": "JEE-ADV-MATH",
                    "name": "JEE Advanced - Mathematics",
                    "tag": "JEE Advanced",
                    "syllabus": "1. Algebra and Quadratic Equations\n2. Matrices and Determinants\n3. Probability and Statistics\n4. Trigonometry\n5. Coordinate Geometry\n6. Differential Calculus\n7. Integral Calculus\n8. Vectors and 3D Geometry",
                    "topics": [
                        {"name": "Algebra and Quadratic Equations", "prereqs": []},
                        {"name": "Matrices and Determinants", "prereqs": ["Algebra and Quadratic Equations"]},
                        {"name": "Probability and Statistics", "prereqs": ["Algebra and Quadratic Equations"]},
                        {"name": "Trigonometry", "prereqs": []},
                        {"name": "Coordinate Geometry", "prereqs": []},
                        {"name": "Differential Calculus", "prereqs": ["Algebra and Quadratic Equations"]},
                        {"name": "Integral Calculus", "prereqs": ["Differential Calculus"]},
                        {"name": "Vectors and 3D Geometry", "prereqs": []}
                    ]
                },
                {
                    "code": "NEET-BIO",
                    "name": "NEET - Biology",
                    "tag": "NEET",
                    "syllabus": "1. Diversity in Living World\n2. Structural Organisation in Animals and Plants\n3. Cell Structure and Function\n4. Plant Physiology\n5. Human Physiology\n6. Reproduction\n7. Genetics and Evolution\n8. Biology and Human Welfare\n9. Biotechnology and Its Applications\n10. Ecology and Environment",
                    "topics": [
                        {"name": "Diversity in Living World", "prereqs": []},
                        {"name": "Structural Organisation in Animals and Plants", "prereqs": []},
                        {"name": "Cell Structure and Function", "prereqs": []},
                        {"name": "Plant Physiology", "prereqs": ["Cell Structure and Function"]},
                        {"name": "Human Physiology", "prereqs": ["Cell Structure and Function"]},
                        {"name": "Reproduction", "prereqs": []},
                        {"name": "Genetics and Evolution", "prereqs": ["Reproduction"]},
                        {"name": "Biology and Human Welfare", "prereqs": []},
                        {"name": "Biotechnology and Its Applications", "prereqs": ["Cell Structure and Function", "Genetics and Evolution"]},
                        {"name": "Ecology and Environment", "prereqs": []}
                    ]
                },
                {
                    "code": "UPSC-POLITY",
                    "name": "UPSC Civil Services - Indian Polity",
                    "tag": "UPSC",
                    "syllabus": "1. Historical Background of Indian Constitution\n2. Preamble and Fundamental Rights\n3. Directive Principles of State Policy\n4. Structure and Functioning of Parliament\n5. Judiciary in India\n6. Federalism and Centre-State Relations\n7. Panchayati Raj and Local Government\n8. Constitutional and Non-Constitutional Bodies\n9. Elections and Electoral Reforms",
                    "topics": [
                        {"name": "Historical Background of Indian Constitution", "prereqs": []},
                        {"name": "Preamble and Fundamental Rights", "prereqs": ["Historical Background of Indian Constitution"]},
                        {"name": "Directive Principles of State Policy", "prereqs": ["Preamble and Fundamental Rights"]},
                        {"name": "Structure and Functioning of Parliament", "prereqs": ["Historical Background of Indian Constitution"]},
                        {"name": "Judiciary in India", "prereqs": []},
                        {"name": "Federalism and Centre-State Relations", "prereqs": ["Historical Background of Indian Constitution"]},
                        {"name": "Panchayati Raj and Local Government", "prereqs": []},
                        {"name": "Constitutional and Non-Constitutional Bodies", "prereqs": []},
                        {"name": "Elections and Electoral Reforms", "prereqs": []}
                    ]
                }
            ]

            for temp in DEFAULT_TEMPLATES:
                sub = models.Subject(
                    org_id=None,
                    user_id=None,
                    code=temp["code"],
                    name=temp["name"],
                    tag=temp["tag"],
                    is_template=True,
                    syllabus_content=temp["syllabus"],
                    progress=0.0
                )
                db.add(sub)
                db.commit()
                db.refresh(sub)

                unit = models.Unit(
                    org_id=None,
                    subject_id=sub.id,
                    name="Generated Curriculum",
                    status="active"
                )
                db.add(unit)
                db.commit()
                db.refresh(unit)

                db_topics = []
                name_to_db_id = {}
                for idx, t_info in enumerate(temp["topics"]):
                    topic = models.Topic(
                        org_id=None,
                        unit_id=unit.id,
                        name=t_info["name"],
                        status="active" if idx == 0 else "locked",
                        mastery_level=0.0
                    )
                    db.add(topic)
                    db.flush()
                    db_topics.append(topic)
                    name_to_db_id[t_info["name"]] = topic.id
                
                db.commit()

                graph_topics = []
                for idx, t_info in enumerate(temp["topics"]):
                    t_id = name_to_db_id[t_info["name"]]
                    prereqs = [name_to_db_id[p] for p in t_info["prereqs"] if p in name_to_db_id]
                    graph_topics.append({
                        "id": t_id,
                        "name": t_info["name"],
                        "description": f"Seeded template topic covering {t_info['name']} under {temp['name']}.",
                        "prerequisites": prereqs
                    })

                workspace_id = f"org/none/groups/unassigned/subjects/{sub.id}"
                graph_data = {"topics": graph_topics}
                curriculum_manager.save_curriculum(workspace_id, graph_data)
                print(f"Seeded template {temp['name']} successfully.")
        db.close()
    except Exception as se:
        print(f"Error seeding database templates: {se}")

@app.on_event("startup")
def startup_event():
    try:
        from pathlib import Path
        temp_dir = Path("agent/memory/temp_uploads")
        temp_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"Error creating temp_uploads dir: {e}")
    start_cleanup_scheduler()
    migrate_and_seed_db()


# Configure CORS
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS")
if allowed_origins_env:
    allow_origins = [origin.strip().rstrip("/.") for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allow_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"]

allowed_origin_regex = os.environ.get("ALLOWED_ORIGIN_REGEX")

cors_kwargs = {
    "allow_origins": allow_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if allowed_origin_regex:
    cors_kwargs["allow_origin_regex"] = allowed_origin_regex

app.add_middleware(
    CORSMiddleware,
    **cors_kwargs
)

# Initialize agent managers
curriculum_manager = CurriculumManager()
research_manager = ResearchManager()
tutor_manager = TutorManager()
project_mentor_manager = ProjectMentorManager()
evaluation_manager = EvaluationManager()
animation_manager = AnimationManager()

models.Base.metadata.create_all(bind=engine)

# --- Admin Organizations Endpoints ---
class OrgCreateRequest(BaseModel):
    name: str
    current_semester: Optional[str] = "Fall 2026"
    teaching_style: Optional[str] = "Friendly"
    is_subscribed: Optional[bool] = False
    usage_limit: Optional[int] = 1000

class OrgUpdateRequest(BaseModel):
    name: Optional[str] = None
    current_semester: Optional[str] = None
    teaching_style: Optional[str] = None
    is_subscribed: Optional[bool] = None
    usage_limit: Optional[int] = None

def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def require_org_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["clg", "admin"]:
        raise HTTPException(status_code=403, detail="Organization Admin access required")
    return current_user

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        return {"status": "error", "message": str(e)}
    return {"status": "ok", "message": "Backend render is up and alive, DB connected"}

@app.get("/api/admin/stats")
def admin_get_stats(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    total_orgs = db.query(models.Organization).count()
    active_learners = db.query(models.User).filter(models.User.org_id != None).count()
    solo_learners = db.query(models.User).filter(models.User.org_id == None).count()
    
    return {
        "total_orgs": total_orgs,
        "active_learners": active_learners,
        "solo_learners": solo_learners
    }

@app.get("/api/admin/analytics/ai")
def admin_analytics_ai(org_id: Optional[int] = None, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    t_q = db.query(models.ChatMessage)
    p_q = db.query(models.ProjectMessage)
    
    if org_id:
        t_q = t_q.join(models.ChatSession).join(models.User).filter(models.User.org_id == org_id)
        p_q = p_q.join(models.Project).filter(models.Project.org_id == org_id)

    tutor_msgs = t_q.count()
    project_msgs = p_q.count()
    
    tutor_ai = t_q.filter(models.ChatMessage.role == "ai").count()
    project_ai = p_q.filter(models.ProjectMessage.role == "ai").count()
    
    return {
        "total_messages": tutor_msgs + project_msgs,
        "total_ai_responses": tutor_ai + project_ai,
        "tutor_messages": tutor_msgs,
        "project_messages": project_msgs
    }

@app.get("/api/admin/analytics/db")
def admin_analytics_db(org_id: Optional[int] = None, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    if org_id:
        return {
            "users": db.query(models.User).filter(models.User.org_id == org_id).count(),
            "organizations": 1,
            "subjects": db.query(models.Subject).filter(models.Subject.org_id == org_id).count(),
            "topics": db.query(models.Topic).filter(models.Topic.org_id == org_id).count(),
            "projects": db.query(models.Project).filter(models.Project.org_id == org_id).count(),
            "chat_sessions": db.query(models.ChatSession).join(models.User).filter(models.User.org_id == org_id).count()
        }
    else:
        return {
            "users": db.query(models.User).count(),
            "organizations": db.query(models.Organization).count(),
            "subjects": db.query(models.Subject).count(),
            "topics": db.query(models.Topic).count(),
            "projects": db.query(models.Project).count(),
            "chat_sessions": db.query(models.ChatSession).count()
        }

@app.get("/api/admin/orgs")
def admin_get_orgs(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    orgs = db.query(models.Organization).all()
    res = []
    for o in orgs:
        res.append({
            "id": o.id,
            "name": o.name,
            "current_semester": o.current_semester,
            "active_students": o.active_students,
            "is_subscribed": o.is_subscribed,
            "usage_limit": o.usage_limit
        })
    return res

class OrgCreateRequest(BaseModel):
    name: str
    current_semester: str
    teaching_style: str
    is_subscribed: bool
    usage_limit: int
    admin_email: Optional[str] = None
    admin_password: Optional[str] = None

@app.post("/api/admin/orgs")
def admin_create_org(req: OrgCreateRequest, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    org = models.Organization(
        name=req.name,
        current_semester=req.current_semester,
        teaching_style=req.teaching_style,
        is_subscribed=req.is_subscribed,
        usage_limit=req.usage_limit
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    
    if req.admin_email and req.admin_password:
        try:
            # Fixed: Using sign_up instead of admin API to work with anon key
            res = supabase_client.auth.sign_up({
                "email": req.admin_email,
                "password": req.admin_password,
                "options": {
                    "data": {
                        "name": f"{req.name} Admin",
                        "role": "clg"
                    }
                }
            })
            if res.user:
                new_user = models.User(
                    id=res.user.id,
                    email=req.admin_email,
                    name=f"{req.name} Admin",
                    role="clg",
                    org_id=org.id,
                    avatar=req.name[0].upper()
                )
                db.add(new_user)
                db.commit()
        except Exception as e:
            print(f"Error creating org admin user: {e}")
            return {"id": org.id, "message": "Organization created, but failed to create admin user."}

    return {"id": org.id, "message": "Organization created successfully"}

@app.put("/api/admin/orgs/{org_id}")
def admin_update_org(org_id: int, req: OrgUpdateRequest, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if req.name is not None: org.name = req.name
    if req.current_semester is not None: org.current_semester = req.current_semester
    if req.teaching_style is not None: org.teaching_style = req.teaching_style
    if req.is_subscribed is not None: org.is_subscribed = req.is_subscribed
    if req.usage_limit is not None: org.usage_limit = req.usage_limit
    
    db.commit()
    return {"ok": True, "message": "Organization updated"}

@app.delete("/api/admin/orgs/{org_id}")
def admin_delete_org(org_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    # Set all users from this org to org_id = None to avoid orphaned foreign keys
    users = db.query(models.User).filter(models.User.org_id == org_id).all()
    for u in users:
        u.org_id = None
    
    db.delete(org)
    db.commit()
    return {"ok": True, "message": "Organization deleted"}


# --- User Endpoints ---
class RegisterRequest(BaseModel):
    name: str
    role: str
    org_id: Optional[int] = None
    org_name: Optional[str] = None

@app.post("/api/auth/register")
def register_user(req: RegisterRequest, credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        user_res = supabase_client.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        org_id = req.org_id
        # Self-serve Organization Creation MUST happen before checking `if user:`
        if req.role == "clg" and req.org_name and not org_id:
            new_org = models.Organization(
                name=req.org_name,
                current_semester="Semester 1",
                teaching_style="Friendly",
                is_subscribed=False,
                usage_limit=1000
            )
            db.add(new_org)
            db.commit()
            db.refresh(new_org)
            org_id = new_org.id

        # Check if already exists by ID
        user = db.query(models.User).filter(models.User.id == user_res.user.id).first()
        if user:
            # Update user info in case they were auto-synced
            user.name = req.name
            user.role = req.role
            user.org_id = org_id
            user.avatar = req.name[0].upper() if req.name else "U"
            db.commit()
            return {"ok": True, "message": "User updated", "id": user.id}
            
        # Check if already exists by Email
        user_by_email = db.query(models.User).filter(models.User.email == user_res.user.email).first()
        if user_by_email:
            return {"ok": True, "message": "User linked successfully", "id": user_by_email.id}
            
        new_user = models.User(
            id=user_res.user.id,
            email=user_res.user.email,
            name=req.name,
            role=req.role,
            org_id=org_id,
            avatar=req.name[0].upper() if req.name else "U"
        )
        db.add(new_user)
        db.commit()
        return {"ok": True, "id": new_user.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/users/me")
def get_current_user_full(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.referral_code:
        import secrets
        import string
        alphabet = string.ascii_uppercase + string.digits
        current_user.referral_code = ''.join(secrets.choice(alphabet) for _ in range(8))
        db.commit()
        db.refresh(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "name": current_user.name,
        "avatar": current_user.avatar,
        "org_id": current_user.org_id,
        "referral_code": current_user.referral_code
    }

class UpdateOrgRequest(BaseModel):
    org_id: int

@app.put("/api/user/org")
def update_user_org(req: UpdateOrgRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if user:
        user.org_id = req.org_id
        db.commit()
        return {"ok": True}
    raise HTTPException(status_code=404, detail="User not found")

@app.get("/api/user/profile")
def get_user_profile(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if user and not user.referral_code:
        import secrets
        import string
        alphabet = string.ascii_uppercase + string.digits
        user.referral_code = ''.join(secrets.choice(alphabet) for _ in range(8))
        db.commit()
        db.refresh(user)
    return {
        "name": user.name if user else None, 
        "avatar": user.avatar if user else None, 
        "overall_progress": user.overall_progress if user else 0.0,
        "tokens": user.tokens if user else 0,
        "referral_code": user.referral_code if user else None
    }

@app.get("/api/user/stats")
def get_user_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    return {"learning_hours_this_week": user.learning_hours_this_week, "topics_completed": user.topics_completed}

@app.get("/api/user/active-module")
def get_active_module(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.org_id is None:
        last_subject = db.query(models.Subject).filter(models.Subject.org_id == None, models.Subject.user_id == current_user.id).order_by(models.Subject.last_opened.desc()).first()
    else:
        last_subject = db.query(models.Subject).join(models.SubjectGroupMapping, models.Subject.id == models.SubjectGroupMapping.subject_id)\
            .join(models.UserGroupMapping, models.SubjectGroupMapping.group_id == models.UserGroupMapping.group_id)\
            .filter(models.UserGroupMapping.user_id == current_user.id)\
            .order_by(models.Subject.last_opened.desc()).first()
    
    if not last_subject:
        return None
    user_progress = recalculate_subject_progress(db, current_user.id, last_subject.id)
    return {"module_name": last_subject.name, "progress": user_progress, "subject_id": last_subject.id}

class SettingsUpdateRequest(BaseModel):
    name: Optional[str] = None
    preferences: Optional[dict] = None

@app.get("/api/user/settings")
def get_user_settings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "name": user.name,
        "email": user.email,
        "preferences": user.preferences or {
            "learning_style": "Visual",
            "notifications": {"email": True, "push": False},
            "privacy": {"show_profile": True}
        }
    }

@app.post("/api/user/settings")
def update_user_settings(req: SettingsUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.name is not None:
        user.name = req.name
    if req.preferences is not None:
        user.preferences = req.preferences
    db.commit()
    return {"ok": True, "message": "Settings updated successfully"}

# --- Organization Student Management Endpoints ---
class BulkStudentItem(BaseModel):
    name: str
    email: str
    group_ids: Optional[List[int]] = []

class BulkStudentRequest(BaseModel):
    students: List[BulkStudentItem]

@app.get("/api/org/students")
def org_get_students(db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    users = db.query(models.User).filter(models.User.org_id == current_user.org_id, models.User.role == "student").all()
    res = []
    for u in users:
        mappings = db.query(models.UserGroupMapping).filter(models.UserGroupMapping.user_id == u.id).all()
        group_ids = [m.group_id for m in mappings]
        res.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "progress": u.overall_progress,
            "status": u.status,
            "group_ids": group_ids
        })
    return res

@app.post("/api/org/students/bulk")
def org_create_students_bulk(req: BulkStudentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    created = 0
    errors = []
    created_credentials = []
    import uuid
    for item in req.students:
        try:
            existing = db.query(models.User).filter(models.User.email == item.email).first()
            if existing:
                errors.append(f"{item.email}: Already exists.")
                continue

            new_user_id = str(uuid.uuid4())
            try:
                auth_res = supabase_client.auth.admin.create_user({
                    "email": item.email,
                    "password": "Welcome123!",
                    "email_confirm": True,
                    "user_metadata": {"name": item.name}
                })
                if auth_res and auth_res.user:
                    new_user_id = auth_res.user.id
            except Exception as auth_e:
                print(f"Supabase Auth creation skipped for {item.email}: {auth_e}")

            new_user = models.User(
                id=new_user_id,
                org_id=current_user.org_id,
                email=item.email,
                name=item.name,
                role="student",
                status="active"
            )
            db.add(new_user)
            db.commit()

            if item.group_ids:
                for gid in item.group_ids:
                    db.add(models.UserGroupMapping(user_id=new_user.id, group_id=gid))
                db.commit()
            
            created += 1
            created_credentials.append({
                "name": item.name,
                "email": item.email,
                "password": "Welcome123!"
            })

        except Exception as e:
            errors.append(f"{item.email}: {str(e)}")

    return {"created": created, "errors": errors, "created_credentials": created_credentials}

class StatusUpdateRequest(BaseModel):
    status: str

@app.put("/api/org/students/{user_id}/status")
def org_update_student_status(user_id: str, req: StatusUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    if req.status not in ["active", "deactivated", "archived"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    student = db.query(models.User).filter(models.User.id == user_id, models.User.org_id == current_user.org_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.status = req.status
    db.commit()
    return {"ok": True}

class TransferRequest(BaseModel):
    group_ids: List[int]

@app.put("/api/org/students/{user_id}/transfer")
def org_transfer_student(user_id: str, req: TransferRequest, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    student = db.query(models.User).filter(models.User.id == user_id, models.User.org_id == current_user.org_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    db.query(models.UserGroupMapping).filter(models.UserGroupMapping.user_id == student.id).delete()
    for gid in req.group_ids:
        db.add(models.UserGroupMapping(user_id=student.id, group_id=gid))
    db.commit()
    return {"ok": True}

# --- Announcements Endpoints ---
class AnnouncementCreateRequest(BaseModel):
    title: str
    content: str

@app.post("/api/org/announcements")
def create_announcement(req: AnnouncementCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    announcement = models.Announcement(
        org_id=current_user.org_id,
        author_id=current_user.id,
        title=req.title,
        content=req.content
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return {"ok": True, "id": announcement.id}

@app.get("/api/org/announcements")
def get_org_announcements(db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    announcements = db.query(models.Announcement).filter(models.Announcement.org_id == current_user.org_id).order_by(models.Announcement.created_at.desc()).all()
    return [{
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "created_at": a.created_at,
        "author_name": a.author.name if a.author else "Admin"
    } for a in announcements]

@app.delete("/api/org/announcements/{id}")
def delete_announcement(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    announcement = db.query(models.Announcement).filter(models.Announcement.id == id, models.Announcement.org_id == current_user.org_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(announcement)
    db.commit()
    return {"ok": True}

@app.get("/api/user/announcements")
def get_user_announcements(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.org_id:
        return []
    announcements = db.query(models.Announcement).filter(models.Announcement.org_id == current_user.org_id).order_by(models.Announcement.created_at.desc()).limit(5).all()
    return [{
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "created_at": a.created_at,
        "author_name": a.author.name if a.author else "Admin"
    } for a in announcements]

# --- Organization Subject Management Endpoints ---
class SubjectCreateRequest(BaseModel):
    code: str
    name: str
    tag: str
    syllabus_content: Optional[str] = None
    syllabus_url: Optional[str] = None
    group_ids: List[int] = []

class SubjectUpdateRequest(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    tag: Optional[str] = None
    syllabus_content: Optional[str] = None
    syllabus_url: Optional[str] = None
    group_ids: Optional[List[int]] = None

class BulkSubjectItem(BaseModel):
    code: str
    name: str
    tag: str
    syllabus_url: Optional[str] = None

class BulkSubjectRequest(BaseModel):
    subjects: List[BulkSubjectItem]

def process_subject_syllabus_background(org_id: Optional[int], subject_id: int, group_ids: List[int], syllabus_content: str):
    group_str = "-".join(map(str, sorted(group_ids))) if group_ids else "unassigned"
    workspace_id = f"org/{org_id or 'none'}/groups/{group_str}/subjects/{subject_id}"
    try:
        graph_data = curriculum_manager.parse_and_save_syllabus(workspace_id, syllabus_content)
        if "topics" in graph_data and len(graph_data["topics"]) > 0:
            db = next(get_db())
            try:
                # Clear existing units and topics for this subject
                existing_units = db.query(models.Unit).filter(models.Unit.subject_id == subject_id).all()
                for u in existing_units:
                    db.query(models.Topic).filter(models.Topic.unit_id == u.id).delete()
                db.query(models.Unit).filter(models.Unit.subject_id == subject_id).delete()
                
                # Create a single unit to hold the AI generated topics
                unit = models.Unit(org_id=org_id, subject_id=subject_id, name="Generated Curriculum", status="active")
                db.add(unit)
                db.commit()
                db.refresh(unit)
                
                json_id_to_db_id = {}
                for t in graph_data["topics"]:
                    topic = models.Topic(
                        org_id=org_id,
                        unit_id=unit.id,
                        name=sanitize_postgres_string(t.get("name")),
                        status="active"
                    )
                    db.add(topic)
                    db.flush()
                    json_id_to_db_id[t.get("id")] = topic.id
                db.commit()

                # Update the json graph on disk to use database IDs
                updated_topics = []
                for t in graph_data["topics"]:
                    old_id = t.get("id")
                    new_id = json_id_to_db_id.get(old_id, old_id)
                    
                    old_prereqs = t.get("prerequisites", [])
                    new_prereqs = [json_id_to_db_id.get(p, p) for p in old_prereqs]
                    
                    t_copy = dict(t)
                    t_copy["id"] = new_id
                    t_copy["prerequisites"] = new_prereqs
                    updated_topics.append(t_copy)
                
                graph_data["topics"] = updated_topics
                curriculum_manager.save_curriculum(workspace_id, graph_data)

            except Exception as dbe:
                print(f"Failed to save AI syllabus to DB: {dbe}")
            finally:
                db.close()
    except Exception as e:
        print(f"Background Syllabus Processing Error: {e}")

@app.get("/api/org/subjects")
def org_get_subjects(db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    subjects = db.query(models.Subject).filter(models.Subject.org_id == current_user.org_id).all()
    res = []
    for s in subjects:
        mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == s.id).all()
        group_ids = [m.group_id for m in mappings]
        res.append({
            "id": s.id,
            "code": s.code,
            "name": s.name,
            "tag": s.tag,
            "syllabus_content": s.syllabus_content,
            "syllabus_url": s.syllabus_url,
            "group_ids": group_ids
        })
    return res

@app.post("/api/org/subjects")
def org_create_subject(req: SubjectCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    sub = models.Subject(
        org_id=current_user.org_id,
        code=sanitize_postgres_string(req.code),
        name=sanitize_postgres_string(req.name),
        tag=sanitize_postgres_string(req.tag),
        syllabus_content=sanitize_postgres_string(req.syllabus_content),
        syllabus_url=sanitize_postgres_string(req.syllabus_url)
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    
    for gid in req.group_ids:
        db.add(models.SubjectGroupMapping(subject_id=sub.id, group_id=gid))
    db.commit()
    
    if req.syllabus_content:
        background_tasks.add_task(process_subject_syllabus_background, current_user.org_id, sub.id, req.group_ids, req.syllabus_content)
    
    return {"id": sub.id, "message": "Subject created successfully"}

@app.post("/api/org/subjects/bulk")
def org_create_subjects_bulk(req: BulkSubjectRequest, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    created_count = 0
    updated_count = 0
    for item in req.subjects:
        sub = db.query(models.Subject).filter(models.Subject.code == item.code, models.Subject.org_id == current_user.org_id).first()
        if sub:
            sub.name = item.name
            sub.tag = item.tag
            if item.syllabus_url:
                sub.syllabus_url = item.syllabus_url
            updated_count += 1
        else:
            new_sub = models.Subject(
                org_id=current_user.org_id,
                code=item.code,
                name=item.name,
                tag=item.tag,
                syllabus_url=item.syllabus_url
            )
            db.add(new_sub)
            created_count += 1
            
    db.commit()
    return {"message": f"Successfully processed {len(req.subjects)} subjects. Created {created_count}, Updated {updated_count}."}

@app.put("/api/org/subjects/{subject_id}")
def org_update_subject(subject_id: int, req: SubjectUpdateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id, models.Subject.org_id == current_user.org_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    if req.code is not None: sub.code = req.code
    if req.name is not None: sub.name = req.name
    if req.tag is not None: sub.tag = req.tag
    if req.syllabus_content is not None: sub.syllabus_content = req.syllabus_content
    if req.syllabus_url is not None: sub.syllabus_url = req.syllabus_url
    
    if req.group_ids is not None:
        db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).delete()
        for gid in req.group_ids:
            db.add(models.SubjectGroupMapping(subject_id=sub.id, group_id=gid))
            
    db.commit()
    
    if req.syllabus_content:
        # Get active group ids if none were passed
        gids = req.group_ids if req.group_ids is not None else [m.group_id for m in db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).all()]
        background_tasks.add_task(process_subject_syllabus_background, current_user.org_id, sub.id, gids, req.syllabus_content)
        
    return {"ok": True, "message": "Subject updated"}

@app.delete("/api/org/subjects/{subject_id}")
def org_delete_subject(subject_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id, models.Subject.org_id == current_user.org_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).delete()
    db.delete(sub)
    db.commit()
    return {"ok": True, "message": "Subject deleted"}

# --- Subject Endpoints ---
@app.get("/api/subjects/active")
def get_active_subjects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.org_id is None:
        subjects = db.query(models.Subject).filter(models.Subject.org_id == None, models.Subject.user_id == current_user.id).all()
    elif current_user.role == "student":
        user_groups = db.query(models.UserGroupMapping).filter(models.UserGroupMapping.user_id == current_user.id).all()
        group_ids = [g.group_id for g in user_groups]
        if not group_ids:
            return []
        subject_mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.group_id.in_(group_ids)).all()
        subject_ids = [m.subject_id for m in subject_mappings]
        if not subject_ids:
            return []
        subjects = db.query(models.Subject).filter(
            models.Subject.id.in_(subject_ids),
            models.Subject.org_id == current_user.org_id
        ).all()
    else:
        subjects = db.query(models.Subject).filter(models.Subject.org_id == current_user.org_id).all()
    res = []
    for s in subjects:
        user_progress = recalculate_subject_progress(db, current_user.id, s.id)
        res.append({"id": s.id, "title": s.name, "tag": s.tag, "progress": user_progress, "time": "recently"})
    return res

@app.post("/api/subjects")
def create_subject(req: SubjectCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.Subject).filter(
        models.Subject.code == req.code,
        models.Subject.org_id == current_user.org_id,
        models.Subject.user_id == (current_user.id if current_user.org_id is None else None)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject with this code already exists")

    sub = models.Subject(
        org_id=current_user.org_id,
        user_id=(current_user.id if current_user.org_id is None else None),
        code=sanitize_postgres_string(req.code),
        name=sanitize_postgres_string(req.name),
        tag=sanitize_postgres_string(req.tag),
        syllabus_content=sanitize_postgres_string(req.syllabus_content),
        syllabus_url=sanitize_postgres_string(req.syllabus_url)
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    
    for gid in req.group_ids:
        group = db.query(models.OrganizationGroup).filter(
            models.OrganizationGroup.id == gid,
            models.OrganizationGroup.org_id == current_user.org_id
        ).first()
        if group:
            db.add(models.SubjectGroupMapping(subject_id=sub.id, group_id=gid))
    db.commit()
    
    if req.syllabus_content:
        background_tasks.add_task(process_subject_syllabus_background, current_user.org_id, sub.id, req.group_ids, req.syllabus_content)
        
    return {"id": sub.id, "message": "Subject created successfully"}

@app.put("/api/subjects/{subject_id}")
def update_subject(subject_id: int, req: SubjectUpdateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.org_id is None:
        sub = db.query(models.Subject).filter(models.Subject.id == subject_id, models.Subject.org_id == None, models.Subject.user_id == current_user.id).first()
    else:
        sub = db.query(models.Subject).filter(models.Subject.id == subject_id, models.Subject.org_id == current_user.org_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found or access denied")
        
    if req.code is not None and req.code != sub.code:
        existing = db.query(models.Subject).filter(
            models.Subject.code == req.code,
            models.Subject.org_id == current_user.org_id,
            models.Subject.user_id == (current_user.id if current_user.org_id is None else None)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Subject with this code already exists")
        sub.code = sanitize_postgres_string(req.code)
        
    if req.name is not None:
        sub.name = sanitize_postgres_string(req.name)
    if req.tag is not None:
        sub.tag = sanitize_postgres_string(req.tag)
    if req.syllabus_content is not None:
        sub.syllabus_content = sanitize_postgres_string(req.syllabus_content)
    if req.syllabus_url is not None:
        sub.syllabus_url = sanitize_postgres_string(req.syllabus_url)
        
    if req.group_ids is not None:
        db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).delete()
        for gid in req.group_ids:
            group = db.query(models.OrganizationGroup).filter(
                models.OrganizationGroup.id == gid,
                models.OrganizationGroup.org_id == current_user.org_id
            ).first()
            if group:
                db.add(models.SubjectGroupMapping(subject_id=sub.id, group_id=gid))
                
    db.commit()
    
    if req.syllabus_content:
        gids = req.group_ids if req.group_ids is not None else [m.group_id for m in db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).all()]
        background_tasks.add_task(process_subject_syllabus_background, current_user.org_id, sub.id, gids, req.syllabus_content)
        
    return {"ok": True, "message": "Subject updated successfully"}


@app.get("/api/recommendations/trending")
def get_trending(db: Session = Depends(get_db)):
    return ["AI Agents", "Prompt Engineering", "React 19"]

def verify_subject_access(sub: models.Subject, current_user: models.User, db: Session):
    if current_user.org_id is None:
        if sub.org_id is not None or sub.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this subject")
    else:
        if sub.org_id != current_user.org_id:
            raise HTTPException(status_code=403, detail="Access denied to this subject")
        if current_user.role == "student":
            user_groups = db.query(models.UserGroupMapping).filter(models.UserGroupMapping.user_id == current_user.id).all()
            group_ids = [g.group_id for g in user_groups]
            if not group_ids:
                raise HTTPException(status_code=403, detail="Access denied to this subject")
            mapping = db.query(models.SubjectGroupMapping).filter(
                models.SubjectGroupMapping.subject_id == sub.id,
                models.SubjectGroupMapping.group_id.in_(group_ids)
            ).first()
            if not mapping:
                raise HTTPException(status_code=403, detail="Access denied to this subject")

@app.get("/api/subjects/{subject_id}/details")
def get_subject_details(subject_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    verify_subject_access(sub, current_user, db)
    units = db.query(models.Unit).filter(models.Unit.subject_id == subject_id).all()
    active_module = units[0].name if units else "General Introduction"
    user_progress = recalculate_subject_progress(db, current_user.id, subject_id)
    return {
        "id": sub.id, 
        "code": sub.code, 
        "name": sub.name, 
        "progress": user_progress, 
        "active_module": active_module, 
        "active_module_progress": 0.0, 
        "time": "recently"
    }

@app.get("/api/subjects/{subject_id}/syllabus")
def get_subject_syllabus(subject_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    verify_subject_access(sub, current_user, db)

    mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).all()
    group_ids = [m.group_id for m in mappings]
    group_str = "-".join(map(str, sorted(group_ids))) if group_ids else "unassigned"
    org_str = sub.org_id if sub.org_id is not None else "none"
    workspace_id = f"org/{org_str}/groups/{group_str}/subjects/{subject_id}"
    
    graph_data = curriculum_manager.load_curriculum(workspace_id)
    if "topics" in graph_data and len(graph_data["topics"]) > 0:
        db_topics = db.query(models.Topic).join(models.Unit).filter(
            models.Unit.subject_id == subject_id
        ).all()
        name_to_db_id = {t.name.lower().strip(): t.id for t in db_topics}

        topics_data = []
        for t in graph_data["topics"]:
            tname = t.get("name", "").lower().strip()
            topic_id_val = name_to_db_id.get(tname, parse_topic_id(t.get("id")))
            if topic_id_val is None:
                topic_id_val = t.get("id")

            mapping = None
            if isinstance(topic_id_val, int):
                mapping = db.query(models.UserTopicMapping).filter(
                    models.UserTopicMapping.user_id == current_user.id,
                    models.UserTopicMapping.topic_id == topic_id_val
                ).first()
            elif str(topic_id_val).isdigit():
                mapping = db.query(models.UserTopicMapping).filter(
                    models.UserTopicMapping.user_id == current_user.id,
                    models.UserTopicMapping.topic_id == int(topic_id_val)
                ).first()

            status = mapping.status if mapping else "active"
            topics_data.append({"id": topic_id_val, "name": t.get("name"), "status": status})
        return [{
            "id": 1,
            "name": "Generated Curriculum",
            "status": "active",
            "topics": topics_data
        }]


    # Fallback to DB
    units = db.query(models.Unit).filter(models.Unit.subject_id == subject_id).all()
    res = []
    if units:
        for u in units:
            topics = db.query(models.Topic).filter(models.Topic.unit_id == u.id).all()
            topics_data = []
            for t in topics:
                mapping = db.query(models.UserTopicMapping).filter(
                    models.UserTopicMapping.user_id == current_user.id,
                    models.UserTopicMapping.topic_id == t.id
                ).first()
                status = mapping.status if mapping else "locked"
                topics_data.append({"id": t.id, "name": t.name, "status": status})
            res.append({
                "id": u.id, "name": u.name, "status": u.status,
                "topics": topics_data
            })
    else:
        # Default placeholder if no syllabus exists in DB
        res = [{
            "id": 999, "name": "Module 1: Getting Started", "status": "active",
            "topics": [
                {"id": 9991, "name": "Introduction", "status": "completed"},
                {"id": 9992, "name": "Core Concepts", "status": "active"},
                {"id": 9993, "name": "Next Steps", "status": "locked"}
            ]
        }]
    return res

@app.get("/api/subjects/{subject_id}/weaknesses")
def get_subject_weaknesses(subject_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    verify_subject_access(sub, current_user, db)
    wks = db.query(models.Weakness).filter(models.Weakness.subject_id == subject_id, models.Weakness.user_id == current_user.id).all()
    return [{"id": w.id, "concept_name": w.concept_name, "needs_practice": w.needs_practice} for w in wks]

@app.get("/api/subjects/{subject_id}/next")
def get_subject_next(subject_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    verify_subject_access(sub, current_user, db)
    units = db.query(models.Unit).filter(models.Unit.subject_id == subject_id).all()
    if units and len(units) > 1:
        return {"name": units[1].name, "reason": f"Based on your progress in {units[0].name}."}
    return {"name": "Continue Learning", "reason": "Keep up the good work!"}

@app.get("/api/subjects/{subject_id}/prerequisites")
def get_subject_prerequisites(subject_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    verify_subject_access(sub, current_user, db)

    mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).all()
    group_ids = [m.group_id for m in mappings]
    group_str = "-".join(map(str, sorted(group_ids))) if group_ids else "unassigned"
    org_str = sub.org_id if sub.org_id is not None else "none"
    workspace_id = f"org/{org_str}/groups/{group_str}/subjects/{subject_id}"
    
    graph_data = curriculum_manager.load_curriculum(workspace_id)
    if "topics" in graph_data and len(graph_data["topics"]) > 0:
        db_topics = db.query(models.Topic).join(models.Unit).filter(
            models.Unit.subject_id == subject_id
        ).all()
        name_to_db_id = {t.name.lower().strip(): t.id for t in db_topics}

        # Build mapping from JSON ID to DB ID
        json_id_to_db_id = {}
        for t in graph_data["topics"]:
            tname = t.get("name", "").lower().strip()
            mapped_id = name_to_db_id.get(tname, parse_topic_id(t.get("id")))
            if mapped_id is None:
                mapped_id = t.get("id")
            json_id_to_db_id[t.get("id")] = mapped_id

        nodes = []
        edges = []
        for t in graph_data["topics"]:
            tid_val = json_id_to_db_id.get(t.get("id"))

            mapping = None
            if isinstance(tid_val, int):
                mapping = db.query(models.UserTopicMapping).filter(
                    models.UserTopicMapping.user_id == current_user.id,
                    models.UserTopicMapping.topic_id == tid_val
                ).first()
            elif str(tid_val).isdigit():
                mapping = db.query(models.UserTopicMapping).filter(
                    models.UserTopicMapping.user_id == current_user.id,
                    models.UserTopicMapping.topic_id == int(tid_val)
                ).first()

            status = mapping.status if mapping else "active"
            nodes.append({"id": tid_val, "name": t.get("name"), "status": status})
            for prereq in t.get("prerequisites", []):
                prereq_val = json_id_to_db_id.get(prereq, prereq)
                edges.append({"from": prereq_val, "to": tid_val})
        return {"nodes": nodes, "edges": edges}


    units = db.query(models.Unit).filter(models.Unit.subject_id == subject_id).all()
    nodes = []
    edges = []
    
    if units:
        for i, u in enumerate(units[:5]):
            nodes.append({"id": f"u{u.id}", "name": u.name, "status": u.status})
            if i > 0:
                edges.append({"from": f"u{units[i-1].id}", "to": f"u{u.id}"})
    else:
        nodes = [
            {"id": "u1", "name": "Module 1: Getting Started", "status": "completed"},
            {"id": "u2", "name": "Module 2: Core Concepts", "status": "active"},
            {"id": "u3", "name": "Module 3: Advanced Topics", "status": "locked"}
        ]
        edges = [
            {"from": "u1", "to": "u2"},
            {"from": "u2", "to": "u3"}
        ]

    return {"nodes": nodes, "edges": edges}

# --- Topic / Chat Endpoints ---
@app.get("/api/topics/{topic_id}")
def get_topic(topic_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    parsed_id = parse_topic_id(topic_id)
    if parsed_id is None:
        raise HTTPException(status_code=400, detail="Invalid topic ID format")
    topic = db.query(models.Topic).filter(models.Topic.id == parsed_id, models.Topic.org_id == current_user.org_id).first()
    if not topic:
        return {"name": f"Topic {topic_id}", "subject_name": "Subject"}
    unit = db.query(models.Unit).filter(models.Unit.id == topic.unit_id, models.Unit.org_id == current_user.org_id).first()
    sub = db.query(models.Subject).filter(models.Subject.id == unit.subject_id, models.Subject.org_id == current_user.org_id).first() if unit else None
    
    mapping = db.query(models.UserTopicMapping).filter(
        models.UserTopicMapping.user_id == current_user.id,
        models.UserTopicMapping.topic_id == parsed_id
    ).first()
    status = mapping.status if mapping else "locked"
    mastery_level = mapping.mastery_level if mapping else 0.0


    return {
        "id": topic.id,
        "name": topic.name,
        "subject_name": sub.name if sub else "",
        "subject_id": sub.id if sub else None,
        "status": status,
        "mastery_level": mastery_level,
        "resources": [
            {"id": 1, "type": "video", "title": f"Understanding {topic.name}", "url": "#", "duration": "12m"},
            {"id": 2, "type": "article", "title": f"{topic.name} Study Guide", "url": "#", "read_time": "5m"},
            {"id": 3, "type": "practice", "title": "Interactive Quiz", "url": "#", "questions": 10}
        ],
        "prerequisites": [
            {"id": topic.id - 1 if topic.id > 1 else 0, "name": "Previous Fundamental Concept", "status": "completed"}
        ] if topic.id > 1 else [],
        "mini_concept_map": [
            {"id": "node1", "label": "Fundamentals", "status": "completed"},
            {"id": "node2", "label": topic.name, "status": "active"},
            {"id": "node3", "label": "Advanced Applications", "status": "locked"}
        ]
    }

@app.get("/api/chat/history/{topic_id}")
def get_chat_history(topic_id: str, db: Session = Depends(get_db)):
    parsed_id = parse_topic_id(topic_id)
    if parsed_id is None:
        raise HTTPException(status_code=400, detail="Invalid topic ID format")
    msgs = db.query(models.ChatHistory).filter(models.ChatHistory.topic_id == parsed_id).order_by(models.ChatHistory.timestamp).all()
    if not msgs:
        return [{"role": "ai", "content": "Let's look at Decomposition. The Chain Rule requires us to break down composite functions into inner and outer layers.\n\nf(x) = h(g(x))\n\nThink of it as an onion. What would you say is the \"outer layer\" of sin(x²)?"}]
    return [{"role": m.role, "content": m.content} for m in msgs]


# --- Organization Endpoints ---
@app.get("/api/orgs")
def get_all_orgs(db: Session = Depends(get_db)):
    orgs = db.query(models.Organization).all()
    return [{"id": o.id, "name": o.name} for o in orgs]

@app.get("/api/org/profile")
def get_org_profile(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.id == current_user.org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    return {"name": org.name, "current_semester": org.current_semester, "teaching_style": org.teaching_style}

@app.get("/api/org/analytics/summary")
def get_org_summary(groups: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    org = db.query(models.Organization).filter(models.Organization.id == current_user.org_id).first()
    if not org: return {}
    
    query = db.query(models.User).filter(models.User.org_id == current_user.org_id, models.User.role == "student", models.User.status == "active")
    
    if groups:
        group_ids = [int(gid) for gid in groups.split(",") if gid.strip().isdigit()]
        if group_ids:
            query = query.join(models.UserGroupMapping).filter(models.UserGroupMapping.group_id.in_(group_ids)).distinct()
            
    users = query.all()
    active_students = len(users)
    
    if active_students == 0:
        return {"active_students": 0, "learning_hours_weekly": 0.0, "ai_engagement_percent": 0.0, "completion_percent": 0.0}
        
    avg_learning = sum((u.learning_hours_this_week or 0) for u in users) / active_students
    avg_progress = sum((u.overall_progress or 0) for u in users) / active_students
    avg_engagement = min(100.0, avg_progress * 1.2)
    
    return {
        "active_students": active_students, 
        "learning_hours_weekly": round(avg_learning, 1), 
        "ai_engagement_percent": round(avg_engagement, 1), 
        "completion_percent": round(avg_progress, 1)
    }

class OrgGroupCreate(BaseModel):
    parent_id: Optional[int] = None
    key: str
    value: str

@app.get("/api/org/groups")
def get_org_groups(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Fetch all groups for the org
    groups = db.query(models.OrganizationGroup).filter(models.OrganizationGroup.org_id == current_user.org_id).all()
    # We could build a tree, but returning a flat list is easier to process flexibly on the frontend
    return [{"id": g.id, "parent_id": g.parent_id, "key": g.key, "value": g.value} for g in groups]

@app.post("/api/org/groups")
def create_org_group(req: OrgGroupCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    new_group = models.OrganizationGroup(
        org_id=current_user.org_id,
        parent_id=req.parent_id,
        key=req.key,
        value=req.value
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return {"ok": True, "id": new_group.id, "key": new_group.key, "value": new_group.value, "parent_id": new_group.parent_id}

@app.delete("/api/org/groups/{group_id}")
def delete_org_group(group_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    group = db.query(models.OrganizationGroup).filter(models.OrganizationGroup.id == group_id, models.OrganizationGroup.org_id == current_user.org_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # cascade delete should handle children if DB constraints are set, but SQLite might need manual cascade or SQLAlchemy takes care of it.
    db.delete(group)
    db.commit()
    return {"ok": True}

@app.get("/api/org/analytics/live")
def get_org_live(groups: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    query = db.query(models.Subject).filter(models.Subject.org_id == current_user.org_id)
    if groups:
        group_ids = [int(gid) for gid in groups.split(",") if gid.strip().isdigit()]
        if group_ids:
            query = query.join(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.group_id.in_(group_ids)).distinct()
    
    subs = query.order_by(models.Subject.active_users.desc()).all()
    return [{"name": s.name, "active_users": s.active_users} for s in subs]

@app.get("/api/org/analytics/insights")
def get_org_insights(groups: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    insights = db.query(models.AIInsight).filter(models.AIInsight.org_id == current_user.org_id).order_by(models.AIInsight.rank).all()
    return [{"rank": i.rank, "bottleneck_name": i.bottleneck_name} for i in insights]

class PersonaRequest(BaseModel):
    style: str

@app.post("/api/org/config/ai-persona")
def update_persona(req: PersonaRequest, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    org = db.query(models.Organization).filter(models.Organization.id == current_user.org_id).first()
    if org:
        org.teaching_style = req.style
        db.commit()
    return {"ok": True, "style": req.style}

class CreateStudentRequest(BaseModel):
    name: str
    email: str

import uuid

@app.post("/api/org/students")
def create_org_student(req: CreateStudentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(require_org_admin)):
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    new_user_id = str(uuid.uuid4())
    try:
        auth_res = supabase_client.auth.admin.create_user({
            "email": req.email,
            "password": "Welcome123!",
            "email_confirm": True,
            "user_metadata": {"name": req.name}
        })
        if auth_res and auth_res.user:
            new_user_id = auth_res.user.id
    except Exception as auth_e:
        print(f"Supabase Auth creation failed: {auth_e}")

    new_student = models.User(
        id=new_user_id,
        email=req.email,
        name=req.name,
        role="student",
        org_id=current_user.org_id,
        status="active",
        avatar=req.name[0].upper() if req.name else "S"
    )
    db.add(new_student)
    db.commit()
    return {"ok": True, "id": new_user_id, "message": "Student created successfully", "password": "Welcome123!"}

# --- Proxy to Agent logic ---
@app.post("/api/tutor/chat")
def tutor_chat(req: ChatRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        # Save user message to history
        topic_id = parse_topic_id(req.topic_id)
        if topic_id is None:
            raise HTTPException(status_code=400, detail="Invalid topic ID format")
        student_id = req.student_id or current_user.id
        user_msg = models.ChatHistory(user_id=current_user.id, topic_id=topic_id, role="user", content=req.student_message)
        db.add(user_msg)
        db.commit()

        cleaned_msg = req.student_message.strip()
        if cleaned_msg.lower().startswith("search:"):
            query = cleaned_msg[7:].strip()
            res = research_manager.perform_dynamic_research(query)
            ai_content = res.get("synthesis", "Error performing research.")
        else:
            # Use topic_id if available for curriculum-aware tutoring
            topic_id_str = str(topic_id) if topic_id else "general"
            
            # Resolve subject_id from topic_id to build the correct workspace_id
            workspace_id = str(current_user.org_id)
            if topic_id:
                topic_db = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
                if topic_db:
                    unit_db = db.query(models.Unit).filter(models.Unit.id == topic_db.unit_id).first()
                    if unit_db:
                        sub = db.query(models.Subject).filter(models.Subject.id == unit_db.subject_id).first()
                        if sub:
                            mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).all()
                            group_ids = [m.group_id for m in mappings]
                            group_str = "-".join(map(str, sorted(group_ids))) if group_ids else "unassigned"
                            org_str = sub.org_id if sub.org_id is not None else "none"
                            workspace_id = f"org/{org_str}/groups/{group_str}/subjects/{sub.id}"
            
            sub_name = sub.name if 'sub' in locals() and sub else None
            result = tutor_manager.get_tutor_response(
                workspace_id=workspace_id,
                student_id=student_id,
                topic_id=topic_id_str,
                student_message=req.student_message,
                category="subject",
                subject_name=sub_name,
                session_id=topic_id_str,
                db=db
            )
            ai_content = result.get("response", "")

        # Save AI message to history
        ai_msg = models.ChatHistory(user_id=current_user.id, topic_id=topic_id, role="ai", content=ai_content)
        db.add(ai_msg)
        db.commit()

        return {"response": ai_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Subjects All ---
@app.get("/api/subjects/all")
def get_all_subjects(db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(get_current_user_optional)):
    if not current_user:
        subjects = db.query(models.Subject).filter(models.Subject.is_template == True).all()
    elif current_user.org_id is None:
        subjects = db.query(models.Subject).filter(models.Subject.org_id == None, models.Subject.user_id == current_user.id).all()
    elif current_user.role == "student":
        user_groups = db.query(models.UserGroupMapping).filter(models.UserGroupMapping.user_id == current_user.id).all()
        group_ids = [g.group_id for g in user_groups]
        if not group_ids:
            return []
        subject_mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.group_id.in_(group_ids)).all()
        subject_ids = [m.subject_id for m in subject_mappings]
        if not subject_ids:
            return []
        subjects = db.query(models.Subject).filter(
            models.Subject.id.in_(subject_ids),
            models.Subject.org_id == current_user.org_id
        ).all()
    else:
        subjects = db.query(models.Subject).filter(models.Subject.org_id == current_user.org_id).all()
    res = []
    for s in subjects:
        res.append({"id": s.id, "code": s.code, "title": s.name, "tag": s.tag, "progress": s.progress, "time": "recently", "active_users": s.active_users, "syllabus_content": s.syllabus_content})
    return res

# --- Subject Sharing and Templates Endpoints ---
@app.get("/api/subjects/templates")
def get_subject_templates(db: Session = Depends(get_db)):
    templates = db.query(models.Subject).filter(models.Subject.is_template == True).all()
    res = []
    for s in templates:
        res.append({
            "id": s.id,
            "code": s.code,
            "title": s.name,
            "tag": s.tag,
            "progress": 0.0,
            "time": "template",
            "active_users": 0,
            "syllabus_content": s.syllabus_content
        })
    return res

@app.post("/api/subjects/{subject_id}/share")
def share_subject(subject_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    if sub.user_id != current_user.id and sub.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied to share this subject")
        
    if not sub.share_code:
        import secrets
        import string
        alphabet = string.ascii_uppercase + string.digits
        sub.share_code = "SUB-" + "".join(secrets.choice(alphabet) for _ in range(8))
        db.commit()
        db.refresh(sub)
        
    return {"share_code": sub.share_code}

class ImportSubjectRequest(BaseModel):
    share_code: Optional[str] = None
    template_id: Optional[int] = None

@app.post("/api/subjects/import")
def import_subject(req: ImportSubjectRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not req.share_code and not req.template_id:
        raise HTTPException(status_code=400, detail="Either share_code or template_id must be provided")
        
    source_sub = None
    if req.share_code:
        source_sub = db.query(models.Subject).filter(models.Subject.share_code == req.share_code).first()
    elif req.template_id:
        source_sub = db.query(models.Subject).filter(models.Subject.id == req.template_id, models.Subject.is_template == True).first()
        
    if not source_sub:
        raise HTTPException(status_code=404, detail="Source subject not found")

    existing = db.query(models.Subject).filter(
        models.Subject.code == source_sub.code,
        models.Subject.user_id == current_user.id,
        models.Subject.org_id == current_user.org_id
    ).first()
    if existing:
        return {"ok": True, "id": existing.id, "message": "Subject already imported"}

    new_sub = models.Subject(
        org_id=current_user.org_id,
        user_id=current_user.id,
        code=source_sub.code,
        name=source_sub.name,
        tag=source_sub.tag,
        syllabus_content=source_sub.syllabus_content,
        syllabus_url=source_sub.syllabus_url,
        progress=0.0
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)

    units = db.query(models.Unit).filter(models.Unit.subject_id == source_sub.id).all()
    topic_id_mapping = {}
    
    for u in units:
        new_unit = models.Unit(
            org_id=current_user.org_id,
            subject_id=new_sub.id,
            name=u.name,
            status=u.status
        )
        db.add(new_unit)
        db.commit()
        db.refresh(new_unit)
        
        topics = db.query(models.Topic).filter(models.Topic.unit_id == u.id).all()
        for t in topics:
            new_topic = models.Topic(
                org_id=current_user.org_id,
                unit_id=new_unit.id,
                name=t.name,
                status=t.status,
                mastery_level=0.0
            )
            db.add(new_topic)
            db.flush()
            topic_id_mapping[t.id] = new_topic.id
            
    db.commit()

    try:
        src_mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == source_sub.id).all()
        src_group_ids = [m.group_id for m in src_mappings]
        src_group_str = "-".join(map(str, sorted(src_group_ids))) if src_group_ids else "unassigned"
        src_org_str = source_sub.org_id if source_sub.org_id is not None else "none"
        src_workspace_id = f"org/{src_org_str}/groups/{src_group_str}/subjects/{source_sub.id}"
        
        graph_data = curriculum_manager.load_curriculum(src_workspace_id)
        if graph_data and "topics" in graph_data:
            updated_topics = []
            for t in graph_data["topics"]:
                old_id = t.get("id")
                new_id = topic_id_mapping.get(old_id, old_id)
                old_prereqs = t.get("prerequisites", [])
                new_prereqs = [topic_id_mapping.get(p, p) for p in old_prereqs]
                
                t_copy = dict(t)
                t_copy["id"] = new_id
                t_copy["prerequisites"] = new_prereqs
                updated_topics.append(t_copy)
            graph_data["topics"] = updated_topics
            
            dest_workspace_id = f"org/none/groups/unassigned/subjects/{new_sub.id}"
            curriculum_manager.save_curriculum(dest_workspace_id, graph_data)
    except Exception as ge:
        print(f"Error copying curriculum graph: {ge}")
        
    return {"ok": True, "id": new_sub.id, "message": "Subject imported successfully"}


# --- Mastery Endpoints ---
@app.get("/api/mastery/heatmap")
def get_mastery_heatmap(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    topics = db.query(models.Topic).filter(models.Topic.org_id == current_user.org_id).all()
    import random
    units = db.query(models.Unit).filter(models.Unit.org_id == current_user.org_id).all()
    result = []
    for u in units:
        unit_topics = [t for t in topics if t.unit_id == u.id]
        if not unit_topics:
            continue
        sub = db.query(models.Subject).filter(models.Subject.id == u.subject_id).first()
        topic_data = []
        for t in unit_topics:
            mapping = db.query(models.UserTopicMapping).filter(
                models.UserTopicMapping.user_id == current_user.id,
                models.UserTopicMapping.topic_id == t.id
            ).first()
            mastery = mapping.mastery_level if mapping else 0.0
            status = mapping.status if mapping else "locked"
            if mastery == 0.0:
                if status == "completed":
                    mastery = random.uniform(80, 100)
                elif status == "active":
                    mastery = random.uniform(30, 70)
                else:
                    mastery = random.uniform(0, 20)
            topic_data.append({
                "id": t.id,
                "name": t.name,
                "mastery": round(mastery, 1),
                "status": status
            })
        result.append({
            "unit_id": u.id,
            "unit_name": u.name,
            "subject_name": sub.name if sub else "Unknown",
            "topics": topic_data
        })
    return result

@app.get("/api/mastery/weaknesses")
def get_mastery_weaknesses(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    wks = db.query(models.Weakness).filter(models.Weakness.user_id == current_user.id).all()
    res = []
    for w in wks:
        sub = db.query(models.Subject).filter(models.Subject.id == w.subject_id).first()
        res.append({
            "id": w.id,
            "concept_name": w.concept_name,
            "subject_name": sub.name if sub else "Unknown",
            "needs_practice": w.needs_practice
        })
    return res

@app.get("/api/mastery/graph")
def get_mastery_graph(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subjects = db.query(models.Subject).join(models.SubjectGroupMapping, models.Subject.id == models.SubjectGroupMapping.subject_id)\
        .join(models.UserGroupMapping, models.SubjectGroupMapping.group_id == models.UserGroupMapping.group_id)\
        .filter(models.UserGroupMapping.user_id == current_user.id).all()
    
    nodes = []
    links = []
    
    for sub in subjects:
        sub_id = f"s_{sub.id}"
        nodes.append({"id": sub_id, "group": 1, "label": sub.name, "val": 10})
        
        units = db.query(models.Unit).filter(models.Unit.subject_id == sub.id).all()
        for unit in units:
            unit_id = f"u_{unit.id}"
            nodes.append({"id": unit_id, "group": 2, "label": unit.name, "val": 8})
            links.append({"source": sub_id, "target": unit_id})
            
            topics = db.query(models.Topic).filter(models.Topic.unit_id == unit.id).all()
            for topic in topics:
                topic_id = f"t_{topic.id}"
                mapping = db.query(models.UserTopicMapping).filter(
                    models.UserTopicMapping.user_id == current_user.id,
                    models.UserTopicMapping.topic_id == topic.id
                ).first()
                mastery_level = mapping.mastery_level if mapping else 0.0
                val = max(4, 4 + (mastery_level / 20)) # scale value 4 to 9 based on mastery
                nodes.append({"id": topic_id, "group": 3, "label": topic.name, "val": val})
                links.append({"source": unit_id, "target": topic_id})

    if not nodes:
        nodes.append({"id": "empty", "group": 1, "label": "No Data Yet", "val": 5})

    return {
        "nodes": nodes,
        "links": links
    }

# --- Notifications ---
@app.get("/api/user/notifications")
def get_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    notifs = db.query(models.Notification).filter(models.Notification.user_id == current_user.id).order_by(models.Notification.timestamp.desc()).all()
    return [{"id": n.id, "title": n.title, "message": n.message, "read": n.read, "category": n.category, "timestamp": str(n.timestamp)} for n in notifs]

@app.post("/api/user/notifications/{notif_id}/read")
def mark_notification_read(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(models.Notification).filter(models.Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read = True
    db.commit()
    return {"ok": True}

# --- Search ---
@app.get("/api/search")
def search_content(q: str = Query("", min_length=1), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = q.lower()
    # Search subjects
    subjects = db.query(models.Subject).filter(models.Subject.name.ilike(f"%{query}%"), models.Subject.org_id == current_user.org_id).all()
    subject_results = [{"type": "subject", "id": s.id, "name": s.name, "code": s.code, "tag": s.tag} for s in subjects]
    # Search topics
    topics = db.query(models.Topic).filter(models.Topic.name.ilike(f"%{query}%"), models.Topic.org_id == current_user.org_id).all()
    topic_results = []
    for t in topics:
        unit = db.query(models.Unit).filter(models.Unit.id == t.unit_id).first()
        sub = db.query(models.Subject).filter(models.Subject.id == unit.subject_id).first() if unit else None
        topic_results.append({"type": "topic", "id": t.id, "name": t.name, "subject_name": sub.name if sub else "", "subject_id": sub.id if sub else 0})
    return {"subjects": subject_results, "topics": topic_results}

# --- Theme ---
class ThemeRequest(BaseModel):
    theme: str  # 'light' or 'dark'

@app.post("/api/user/settings/theme")
def update_theme(req: ThemeRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    user.theme_preference = req.theme
    db.commit()
    return {"ok": True, "theme": req.theme}

@app.get("/api/user/settings/theme")
def get_theme(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    return {"theme": user.theme_preference or "light"}

# ═══════════════════════════════════════════════════
# TUTOR SESSION ENDPOINTS (ChatGPT-style interface)
# ═══════════════════════════════════════════════════

class CreateSessionRequest(BaseModel):
    title: str = "New Chat"
    category: str = "free"  # "subject", "topic", "free"
    subject_id: Optional[int] = None
    topic_id: Optional[Any] = None


class SessionMessageRequest(BaseModel):
    content: Optional[str] = None
    message: Optional[str] = None
    workspace_id: str = "default"
    student_id: Optional[str] = None
    location: str = "general_chat"
    preferences: Optional[Dict[str, Any]] = None
    action: Optional[str] = None
    attachments: Optional[List[dict]] = None
    history: Optional[List[Dict[str, Any]]] = None
    is_big_topic: Optional[bool] = None
    agenda: Optional[List[str]] = None
    current_index: Optional[int] = None
    topic_id: Optional[Any] = None
    subject_id: Optional[int] = None
    device_id: Optional[str] = None
    is_free_reply: Optional[bool] = False



@app.post("/api/tutor/upload")
def upload_tutor_file(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user)):
    """Upload a file temporarily for chat context."""
    try:
        import uuid
        import shutil
        
        # Ensure temporary uploads directory exists
        temp_dir = os.path.join("agent", "memory", "temp_uploads")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Create a unique sanitized filename to prevent overwrites and path traversal
        clean_filename = Path(file.filename).name
        file_id = f"{uuid.uuid4().hex}_{clean_filename}"
        dest_path = (Path(temp_dir) / file_id).resolve()
        try:
            dest_path.relative_to(Path(temp_dir).resolve())
        except ValueError:
            raise HTTPException(status_code=400, detail="Path traversal detected in upload filename.")
        
        # Write file to disk
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_size = os.path.getsize(dest_path)
        
        # Limit file size to 10MB
        if file_size > 10 * 1024 * 1024:
            os.remove(dest_path)
            raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit.")
            
        # Extract content preview
        content_preview = ""
        ext = os.path.splitext(file.filename)[1].lower()
        if ext in ['.txt', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.md', '.csv', '.yml', '.yaml']:
            try:
                with open(dest_path, "r", encoding="utf-8", errors="ignore") as f:
                    content_preview = f.read(5000) # Read up to 5000 chars
            except Exception:
                pass
        elif ext == '.pdf':
            try:
                import pypdf
                reader = pypdf.PdfReader(dest_path)
                text = ""
                for page in reader.pages[:3]: # First 3 pages
                    t = page.extract_text()
                    if t:
                        text += t
                    if len(text) > 5000:
                        break
                content_preview = text[:5000]
            except ImportError:
                content_preview = "[PDF library not available; text preview skipped]"
            except Exception as e:
                content_preview = f"[Error reading PDF: {str(e)}]"
                
        return {
            "file_id": file_id,
            "filename": file.filename,
            "file_size": file_size,
            "content_preview": sanitize_postgres_string(content_preview)
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@app.get("/api/tutor/files/{file_id}")
def get_tutor_file(file_id: str, current_user: models.User = Depends(get_current_user)):
    """Retrieve an uploaded file."""
    temp_dir = os.path.join("agent", "memory", "temp_uploads")
    file_path = os.path.join(temp_dir, file_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found or expired")
    return FileResponse(file_path)

@app.get("/api/tutor/sessions")
def list_sessions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """List all chat sessions grouped by category with last message preview."""
    sessions = db.query(models.ChatSession).filter(
        models.ChatSession.user_id == current_user.id
    ).order_by(models.ChatSession.updated_at.desc()).all()
    
    result = []
    for s in sessions:
        last_msg = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == s.id
        ).order_by(models.ChatMessage.timestamp.desc()).first()
        
        msg_count = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == s.id
        ).count()
        
        # Get subject/topic names
        subject_name = None
        topic_name = None
        if s.subject_id:
            sub = db.query(models.Subject).filter(models.Subject.id == s.subject_id).first()
            subject_name = sub.name if sub else None
        if s.topic_id:
            top = db.query(models.Topic).filter(models.Topic.id == s.topic_id).first()
            topic_name = top.name if top else None
        
        result.append({
            "id": s.id,
            "title": s.title,
            "category": s.category,
            "subject_id": s.subject_id,
            "topic_id": s.topic_id,
            "subject_name": subject_name,
            "topic_name": topic_name,
            "message_count": msg_count,
            "last_message": last_msg.content[:100] if last_msg else None,
            "last_role": last_msg.role if last_msg else None,
            "created_at": str(s.created_at),
            "updated_at": str(s.updated_at),
        })
    return result

@app.post("/api/tutor/sessions")
def create_session(req: CreateSessionRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create a new chat session."""
    parsed_topic_id = parse_topic_id(req.topic_id)
    if parsed_topic_id:
        existing = db.query(models.ChatSession).filter(
            models.ChatSession.user_id == current_user.id,
            models.ChatSession.topic_id == parsed_topic_id
        ).first()
        if existing:
            return {"id": existing.id, "title": existing.title, "category": existing.category}

    title = req.title
    if parsed_topic_id and req.category == "topic":
        topic_db = db.query(models.Topic).filter(models.Topic.id == parsed_topic_id).first()
        if topic_db:
            title = topic_db.name

    session = models.ChatSession(
        user_id=current_user.id,
        title=title,
        category=req.category,
        subject_id=req.subject_id,
        topic_id=parsed_topic_id,
    )

    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "title": session.title, "category": session.category}

@app.get("/api/tutor/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get session details with metadata."""
    s = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    
    subject_name = None
    topic_name = None
    if s.subject_id:
        sub = db.query(models.Subject).filter(models.Subject.id == s.subject_id).first()
        subject_name = sub.name if sub else None
    if s.topic_id:
        top = db.query(models.Topic).filter(models.Topic.id == s.topic_id).first()
        topic_name = top.name if top else None
    
    return {
        "id": s.id, "title": s.title, "category": s.category,
        "subject_id": s.subject_id, "topic_id": s.topic_id,
        "subject_name": subject_name, "topic_name": topic_name,
        "created_at": str(s.created_at),
    }

@app.get("/api/tutor/sessions/{session_id}/messages")
def get_session_messages(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get all messages for a session."""
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    msgs = db.query(models.ChatMessage).filter(
        models.ChatMessage.session_id == session_id
    ).order_by(models.ChatMessage.timestamp).all()
    
    return [{"id": m.id, "role": m.role, "content": m.content, "timestamp": str(m.timestamp)} for m in msgs]

@app.get("/api/tutor/sessions/{session_id}/task")
def get_session_task(session_id: str):
    """Get the current background task state from TaskMemoryManager."""
    try:
        from core.task_engine import TaskMemoryManager
        memory_manager = TaskMemoryManager()
        mem = memory_manager.load_memory(session_id)
        if not mem or not mem.get("recent_events"):
            return {"status": "pending"}
            
        # Check if the last event is the completion of the orchestrator
        last_event = mem["recent_events"][-1]
        if last_event.get("event") == "orchestrator_complete":
            # Get the full data and return it
            return {
                "status": "completed",
                "payload": last_event.get("data")
            }
            
        return {"status": "running", "progress": last_event}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def process_layer3_tracker(org_id: int, user_id: str, subject_id: int, topic_id: int, ai_data: Dict[str, Any]):
    """Layer 3: Parallel Syllabus Tracker"""
    try:
        db = next(get_db())
        # If the user completed an action or agenda step
        if "requires_action" in ai_data and ai_data.get("action_taken") == "quiz_passed":
            # Just an example of how you'd track mastery
            topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
            if topic:
                topic.status = "completed"
                db.commit()
        db.close()
    except Exception as e:
        print(f"Layer 3 Tracker Error: {e}")

def analyze_subject_chat_progress_background(session_id: int, user_id: str, subject_id: int):
    """
    Background analyzer for general subject chats.
    Prompts the LLM to inspect the last 10 messages and check if any remaining syllabus topics
    have been completed by the student.
    """
    try:
        from core.brain.llm_cloud import run_llm
        import json
        import re

        db = next(get_db())
        
        # 1. Fetch last 10 messages
        messages = (
            db.query(models.ChatMessage)
            .filter(models.ChatMessage.session_id == session_id)
            .order_by(models.ChatMessage.timestamp.desc())
            .limit(10)
            .all()
        )
        if not messages:
            db.close()
            return
            
        messages = list(reversed(messages))
        
        transcript = ""
        for m in messages:
            transcript += f"{m.role.upper()}: {m.content}\n"

        # 2. Fetch remaining uncompleted topics
        all_topics = db.query(models.Topic).join(models.Unit).filter(models.Unit.subject_id == subject_id).all()
        uncompleted_topics = []
        for t in all_topics:
            mapping = db.query(models.UserTopicMapping).filter(
                models.UserTopicMapping.user_id == user_id,
                models.UserTopicMapping.topic_id == t.id
            ).first()
            if not mapping or mapping.status != "completed":
                uncompleted_topics.append(t)

        if not uncompleted_topics:
            db.close()
            return

        # 3. Prompt LLM
        topic_list = [{"id": t.id, "name": t.name} for t in uncompleted_topics]
        
        system_prompt = (
            "You are an educational assessment analyzer. Your task is to analyze a conversation transcript between a student and an AI tutor "
            "to determine if the student has shown clear understanding, correct answers, or mastery of any specific syllabus topics.\n"
            "For a topic to be marked as completed, the student must have actively demonstrated understanding of the topic's core concept "
            "(e.g., by answering a conceptual question correctly, explaining it correctly, or solving a related problem during the conversation).\n"
            "Simply mentioning a topic name, saying 'yes I know it', or having the tutor explain the topic without student confirmation is NOT enough.\n"
            "Analyze the conversation carefully and output ONLY a JSON object listing the IDs of the topics that have been successfully completed/mastered by the student.\n"
            "Format the response EXACTLY like this: {\"completed_topic_ids\": [123, 456]}\n"
            "If no topics were completed/mastered by the student in the given transcript, return: {\"completed_topic_ids\": []}\n"
            "Do not include any other text, markdown formatting, or explanations."
        )
        
        prompt = (
            f"Remaining Uncompleted Topics:\n{json.dumps(topic_list, indent=2)}\n\n"
            f"Conversation Transcript (Last 10 messages):\n{transcript}\n\n"
            f"Which of the remaining topics has the student demonstrated clear understanding of?"
        )

        response = run_llm(prompt, system_prompt=system_prompt)
        
        # 4. Parse LLM response
        cleaned = response.strip() if isinstance(response, str) else ""
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
            cleaned = re.sub(r"\n```$", "", cleaned)
            cleaned = cleaned.strip()

        try:
            res_data = json.loads(cleaned)
            completed_ids = res_data.get("completed_topic_ids", [])
        except Exception as pe:
            print(f"Error parsing LLM response for subject chat progress analysis: {pe}. Raw response: {response}")
            completed_ids = []

        # 5. Update user topic mappings
        updated = False
        valid_uncompleted_ids = {t.id for t in uncompleted_topics}
        for t_id in completed_ids:
            if t_id in valid_uncompleted_ids:
                mapping = db.query(models.UserTopicMapping).filter(
                    models.UserTopicMapping.user_id == user_id,
                    models.UserTopicMapping.topic_id == t_id
                ).first()
                if not mapping:
                    mapping = models.UserTopicMapping(
                        user_id=user_id,
                        topic_id=t_id
                    )
                    db.add(mapping)
                mapping.status = "completed"
                if mapping.mastery_level < 70.0:
                    mapping.mastery_level = 70.0
                updated = True

        if updated:
            db.commit()
            update_user_overall_progress(db, user_id)
        
        db.close()
    except Exception as e:
        print(f"analyze_subject_chat_progress_background error: {e}")

def _save_ws_user_message_to_db(session_id: str, content: str):
    if str(session_id).isdigit():
        from database import SessionLocal
        import models
        from datetime import datetime
        db_session = SessionLocal()
        try:
            s_id_int = int(session_id)
            s_db = db_session.query(models.ChatSession).filter(models.ChatSession.id == s_id_int).first()
            if s_db:
                user_msg = models.ChatMessage(session_id=s_id_int, role="user", content=content)
                db_session.add(user_msg)
                msg_count = db_session.query(models.ChatMessage).filter(models.ChatMessage.session_id == s_id_int).count()
                if msg_count == 1 and s_db.title == "New Chat":
                    s_db.title = content[:50] + ("..." if len(content) > 50 else "")
                s_db.updated_at = datetime.utcnow()
                db_session.commit()
        except Exception as e:
            print(f"Error saving user message to DB: {e}")
        finally:
            db_session.close()

def _save_ws_ai_message_to_db(session_id: str, content: str):
    if str(session_id).isdigit():
        from database import SessionLocal
        import models
        from datetime import datetime
        db_session = SessionLocal()
        try:
            s_id_int = int(session_id)
            s_db = db_session.query(models.ChatSession).filter(models.ChatSession.id == s_id_int).first()
            if s_db:
                ai_msg = models.ChatMessage(session_id=s_id_int, role="ai", content=content)
                db_session.add(ai_msg)
                s_db.updated_at = datetime.utcnow()
                db_session.commit()
        except Exception as e:
            print(f"Error saving AI message to DB: {e}")
        finally:
            db_session.close()

@app.websocket("/api/tutor/ws/{session_id}")
async def tutor_websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for event-driven turn-based teaching with step_ack backpressure.
    Enforces user authentication, session ownership, and tenant workspace isolation.
    """
    await websocket.accept()

    # Extract auth token from query params (?token=... or ?access_token=...) or headers
    auth_token = websocket.query_params.get("token") or websocket.query_params.get("access_token")
    if not auth_token:
        auth_hdr = websocket.headers.get("authorization")
        if auth_hdr and auth_hdr.lower().startswith("bearer "):
            auth_token = auth_hdr[7:].strip()

    from database import SessionLocal
    db = SessionLocal()
    authenticated_user = None
    try:
        if auth_token:
            authenticated_user = authenticate_token_string(auth_token, db)

        # Enforce session ownership for numeric database sessions
        if str(session_id).isdigit():
            db_sess = db.query(models.ChatSession).filter(models.ChatSession.id == int(session_id)).first()
            if db_sess and db_sess.user_id:
                if not authenticated_user:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Authentication required for this session."
                    })
                    await websocket.close(code=4001)
                    return
                if str(db_sess.user_id) != str(authenticated_user.id):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Forbidden: you do not own this chat session."
                    })
                    await websocket.close(code=4003)
                    return
    finally:
        db.close()

    requested_ws = websocket.query_params.get("workspace_id")
    if authenticated_user:
        student_id = str(authenticated_user.id)
        workspace_id = requested_ws or f"user_{authenticated_user.id}"
    else:
        student_id = "guest"
        workspace_id = requested_ws or "default"

    if student_id == "guest":
        try:
            tutor_manager.turn_executor.state_manager.delete_session(str(session_id))
        except Exception as e:
            print(f"[WS] Error deleting initial guest state for {session_id}: {e}")

    step_index = 0
    pending_continuation = False
    current_turn_id = str(uuid.uuid4())
    history = []
    prefetched_task: Optional[asyncio.Task] = None
    
    if student_id != "guest" or str(session_id).isdigit():
        history = tutor_manager.load_chat_history(workspace_id, student_id, str(session_id))
        
    profile = tutor_manager.load_student_profile(workspace_id, student_id)

    def spawn_prefetch(next_idx: int, cur_hist: list) -> asyncio.Task:
        """Prefetch next step in the background while client is actively speaking/drawing current step."""
        return asyncio.create_task(
            tutor_manager.turn_executor.execute_step(
                session_id=session_id,
                workspace_id=workspace_id,
                student_id=student_id,
                user_message=None,
                step_index=next_idx,
                history=cur_hist,
                profile=profile,
            )
        )
    
    incoming_queue: asyncio.Queue = asyncio.Queue()

    async def ws_reader():
        try:
            while True:
                data = await websocket.receive_text()
                await incoming_queue.put(data)
        except (WebSocketDisconnect, Exception):
            await incoming_queue.put(None)

    reader_task = asyncio.create_task(ws_reader())

    async def run_step_with_cancellation(step_coro_or_task):
        nonlocal prefetched_task, pending_continuation, step_index, current_turn_id
        if isinstance(step_coro_or_task, asyncio.Task):
            exec_task = step_coro_or_task
        else:
            exec_task = asyncio.create_task(step_coro_or_task)
            
        read_task = asyncio.create_task(incoming_queue.get())
        done, pending = await asyncio.wait(
            [exec_task, read_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        if exec_task in done:
            if not read_task.done():
                read_task.cancel()
            try:
                await read_task
            except (asyncio.CancelledError, Exception):
                pass
            return exec_task.result(), None
        else:
            # Incoming message arrived while exec_task was running!
            incoming = read_task.result()
            exec_task.cancel()
            try:
                await exec_task
            except (asyncio.CancelledError, Exception):
                pass
                
            if incoming is None:
                return None, "disconnected"
                
            try:
                parsed_payload = json.loads(incoming)
            except Exception:
                parsed_payload = {"type": "message", "message": incoming}
                
            p_type = parsed_payload.get("type", "message")
            if p_type == "cancel":
                if prefetched_task and not prefetched_task.done():
                    prefetched_task.cancel()
                prefetched_task = None
                pending_continuation = False
                step_index = 0
                try:
                    await websocket.send_json({"type": "yield", "turn_id": current_turn_id, "reason": "cancelled"})
                    await websocket.send_json({"type": "status", "turn_id": current_turn_id, "data": "teaching_finished"})
                except Exception:
                    pass
                return None, "cancelled"
            else:
                return None, parsed_payload

    try:
        current_payload = None
        while True:
            if current_payload:
                payload = current_payload
                current_payload = None
            else:
                incoming_data = await incoming_queue.get()
                if incoming_data is None:
                    break
                try:
                    payload = json.loads(incoming_data)
                except Exception:
                    payload = {"type": "message", "message": incoming_data}
            
            try:
                msg_type = payload.get("type", "message")
                
                if msg_type == "cancel":
                    if prefetched_task and not prefetched_task.done():
                        prefetched_task.cancel()
                    prefetched_task = None
                    pending_continuation = False
                    step_index = 0
                    try:
                        await websocket.send_json({"type": "yield", "turn_id": current_turn_id, "reason": "cancelled"})
                        await websocket.send_json({"type": "status", "turn_id": current_turn_id, "data": "teaching_finished"})
                    except Exception:
                        pass
                    continue
                    
                if msg_type in ["step_ack", "step_finished"]:
                    if pending_continuation:
                        pending_continuation = False
                        step_index += 1
                        
                        target_task = prefetched_task if prefetched_task else tutor_manager.turn_executor.execute_step(
                            session_id=session_id,
                            workspace_id=workspace_id,
                            student_id=student_id,
                            user_message=None,
                            step_index=step_index,
                            history=history,
                            profile=profile,
                        )
                        prefetched_task = None
                        
                        step_result, interrupt = await run_step_with_cancellation(target_task)
                        if interrupt == "disconnected":
                            break
                        if interrupt == "cancelled":
                            continue
                        if isinstance(interrupt, dict):
                            current_payload = interrupt
                            continue
                        if not step_result:
                            continue
                            
                        history = step_result.updated_history
                        _save_ws_ai_message_to_db(session_id, step_result.chat_markdown)
                        
                        await websocket.send_json({
                            "type": "chat",
                            "turn_id": current_turn_id,
                            "step_index": step_index,
                            "data": {"role": "ai", "content": step_result.chat_markdown}
                        })
                        if step_result.voice_payload:
                            await websocket.send_json({
                                "type": "voice",
                                "turn_id": current_turn_id,
                                "step_index": step_index,
                                "data": step_result.voice_payload
                            })
                            
                        if step_result.yield_decision == "continue":
                            pending_continuation = True
                            prefetched_task = spawn_prefetch(step_index + 1, list(history))
                        elif step_result.yield_decision == "ask":
                            await websocket.send_json({"type": "ask", "turn_id": current_turn_id, "question": step_result.ask_question})
                            await websocket.send_json({"type": "yield", "turn_id": current_turn_id, "reason": "ask"})
                            await websocket.send_json({"type": "status", "turn_id": current_turn_id, "data": "teaching_finished"})
                        else:
                            await websocket.send_json({"type": "yield", "turn_id": current_turn_id, "reason": "done"})
                            await websocket.send_json({"type": "status", "turn_id": current_turn_id, "data": "teaching_finished"})
                            step_index = 0
                    continue
                    
                if msg_type in ["message", "chat"]:
                    if prefetched_task and not prefetched_task.done():
                        prefetched_task.cancel()
                    prefetched_task = None

                    user_msg_text = payload.get("message") or payload.get("content") or ""
                    if not user_msg_text.strip():
                        continue
                        
                    workspace_id = payload.get("workspace_id", workspace_id)
                    student_id = payload.get("student_id", student_id)
                    current_turn_id = payload.get("turn_id", str(uuid.uuid4()))
                    
                    current_state = tutor_manager.turn_executor.state_manager.load_or_create_session(str(session_id))
                    topic_triggers = ["explain ", "what is ", "teach me about ", "teach me ", "tell me about ", "dive into ", "let's learn about ", "let's learn ", "start topic", "new topic", "switch topic"]
                    is_new_topic_request = any(user_msg_text.lower().strip().startswith(trig) for trig in topic_triggers)
                    
                    has_active_lesson = bool(current_state.plan and current_state.nodes)
                    if has_active_lesson and not is_new_topic_request and student_id != "guest":
                        step_index = current_state.step_counter + 1
                    else:
                        step_index = 0
                        current_state.plan = None
                        current_state.nodes = []
                        current_state.overlays = []
                        current_state.connections = []
                        current_state.step_counter = 0
                        current_state.plan_current_index = 0
                        tutor_manager.turn_executor.state_manager.save(current_state)

                    pending_continuation = False
                    
                    _save_ws_user_message_to_db(session_id, user_msg_text)
                    history.append({"role": "user", "content": user_msg_text})
                    
                    step_result, interrupt = await run_step_with_cancellation(
                        tutor_manager.turn_executor.execute_step(
                            session_id=session_id,
                            workspace_id=workspace_id,
                            student_id=student_id,
                            user_message=user_msg_text,
                            step_index=step_index,
                            history=history,
                            profile=profile,
                        )
                    )
                    if interrupt == "disconnected":
                        break
                    if interrupt == "cancelled":
                        continue
                    if isinstance(interrupt, dict):
                        current_payload = interrupt
                        continue
                    if not step_result:
                        continue
                        
                    history = step_result.updated_history
                    _save_ws_ai_message_to_db(session_id, step_result.chat_markdown)
                    
                    await websocket.send_json({
                        "type": "chat",
                        "turn_id": current_turn_id,
                        "step_index": step_index,
                        "data": {"role": "ai", "content": step_result.chat_markdown}
                    })
                    if step_result.voice_payload:
                        await websocket.send_json({
                            "type": "voice",
                            "turn_id": current_turn_id,
                            "step_index": step_index,
                            "data": step_result.voice_payload
                        })
                        
                    if step_result.yield_decision == "continue":
                        pending_continuation = True
                        prefetched_task = spawn_prefetch(step_index + 1, list(history))
                    elif step_result.yield_decision == "ask":
                        await websocket.send_json({"type": "ask", "turn_id": current_turn_id, "question": step_result.ask_question})
                        await websocket.send_json({"type": "yield", "turn_id": current_turn_id, "reason": "ask"})
                        await websocket.send_json({"type": "status", "turn_id": current_turn_id, "data": "teaching_finished"})
                    else:
                        await websocket.send_json({"type": "yield", "turn_id": current_turn_id, "reason": "done"})
                        await websocket.send_json({"type": "status", "turn_id": current_turn_id, "data": "teaching_finished"})
                        step_index = 0
                    continue
            except Exception as e:
                print(f"[WS] Error processing message in tutor websocket: {e}")
                import traceback
                traceback.print_exc()
                try:
                    await websocket.send_json({
                        "type": "chat",
                        "turn_id": current_turn_id,
                        "data": {"role": "ai", "content": "Let us continue our chalkboard lesson."}
                    })
                    await websocket.send_json({"type": "yield", "turn_id": current_turn_id, "reason": "error"})
                except Exception:
                    pass
                
    except WebSocketDisconnect:
        print(f"Client disconnected from tutor WS: {session_id}")
    except Exception as e:
        print(f"Unhandled exception in tutor_websocket_endpoint: {e}")
        import traceback
        traceback.print_exc()
        try:
            profile = tutor_manager.load_student_profile(workspace_id, student_id)
            if hasattr(tutor_manager, "task_engine") and hasattr(tutor_manager.task_engine, "memory_manager"):
                task_mem = tutor_manager.task_engine.memory_manager.load_memory(session_id)
                if task_mem.get("user_profile"):
                    if task_mem["user_profile"].get("weak_concepts"):
                        profile["weak_concepts"].extend(task_mem["user_profile"]["weak_concepts"])
                        profile["weak_concepts"] = list(set(profile["weak_concepts"]))
                    for tid, delta in task_mem["user_profile"].get("mastery_updates", {}).items():
                        profile["mastery"][tid] = profile.get("mastery", {}).get(tid, 0) + delta
                    tutor_manager.save_student_profile(workspace_id, student_id, profile)
        except Exception as e:
            print(f"Error saving profile on disconnect: {e}")
    finally:
        if reader_task and not reader_task.done():
            reader_task.cancel()
        if prefetched_task and not prefetched_task.done():
            prefetched_task.cancel()
        prefetched_task = None
        if student_id == "guest":
            try:
                tutor_manager.turn_executor.state_manager.delete_session(str(session_id))
            except Exception as e:
                print(f"[WS] Error deleting guest state on disconnect for {session_id}: {e}")
        try:
            await websocket.close()
        except:
            pass

class TutorFeedbackRequest(BaseModel):
    rating: int
    tags: List[str] = []
    comment: Optional[str] = ""
    timestamp: Optional[str] = None
    platform: Optional[str] = "desktop"

@app.post("/api/tutor/feedback")
def submit_tutor_feedback(req: TutorFeedbackRequest, db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(get_current_user_optional)):
    """Record student feedback from the learning session."""
    user_id = current_user.id if current_user else "anonymous"
    print(f"[FEEDBACK] Rating: {req.rating}⭐ | Tags: {req.tags} | Comment: {req.comment} | User: {user_id} | Platform: {req.platform}")
    return {"status": "ok", "message": "Feedback recorded successfully"}

@app.post("/api/tutor/sessions/{session_id}/messages")
def send_session_message(session_id: str, req: SessionMessageRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(get_current_user_optional)):
    """Send a message in a session and get AI response."""
    # 1. Handle Guest Flow (Stateless Socratic Tutor)
    if current_user is None or str(session_id).startswith("guest"):
        try:
            # Check guest device credits limit
            guest_credits_left = None
            if req.device_id:
                guest_dev = db.query(models.GuestDevice).filter(models.GuestDevice.device_id == req.device_id).first()
                if not guest_dev:
                    guest_dev = models.GuestDevice(device_id=req.device_id, credits=10)
                    db.add(guest_dev)
                    db.commit()
                    db.refresh(guest_dev)
                
                if guest_dev.credits <= 0 and not req.is_free_reply:
                    raise HTTPException(status_code=403, detail="You have used all 10 free guest credits. Please create a free account to continue learning with your AI Socratic Tutor!")
                
                if not req.is_free_reply:
                    guest_dev.credits -= 1
                    db.commit()
                    db.refresh(guest_dev)
                
                guest_credits_left = guest_dev.credits

            # Prepare content for the agent
            raw_content = req.content or req.message or ""
            user_message_content = raw_content
            agent_message_content = raw_content
            
            if req.attachments:
                attachment_names = ", ".join([att.get("filename", "file") for att in req.attachments])
                attachment_details = "\n\n--- ATTACHED FILE CONTEXT ---"
                for att in req.attachments:
                    filename = att.get("filename", "file")
                    preview = att.get("content_preview", "")
                    attachment_details += f"\n\nFile Name: {filename}\nFile Content:\n{preview}\n-----------------------------"
                agent_message_content = raw_content + attachment_details

            # Reconstruct history list
            history_list = req.history if req.history is not None else []
            
            # Reconstruct is_big_topic, agenda, current_index
            is_big_topic = req.is_big_topic or False
            agenda = req.agenda
            current_index = req.current_index or 0

            # Resolve subject_id and workspace_id dynamically if available
            subject_name = None
            workspace_id = req.workspace_id or "default"
            
            subject_id = req.subject_id
            topic_id = req.topic_id
            if topic_id and not subject_id:
                topic_id_int = parse_topic_id(topic_id)
                if topic_id_int:
                    topic_db = db.query(models.Topic).filter(models.Topic.id == topic_id_int).first()
                    if topic_db:
                        unit_db = db.query(models.Unit).filter(models.Unit.id == topic_db.unit_id).first()
                        if unit_db:
                            subject_id = unit_db.subject_id

            if subject_id:
                sub = db.query(models.Subject).filter(models.Subject.id == int(subject_id)).first()
                if sub:
                    subject_name = sub.name
                    mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).all()
                    group_ids = [m.group_id for m in mappings]
                    group_str = "-".join(map(str, sorted(group_ids))) if group_ids else "unassigned"
                    org_str = sub.org_id if sub.org_id is not None else "none"
                    workspace_id = f"org/{org_str}/groups/{group_str}/subjects/{subject_id}"

            # Call TutorManager to get AI response
            ai_data = tutor_manager.get_tutor_response(
                workspace_id=workspace_id,
                student_id="guest",
                topic_id=str(req.topic_id) if req.topic_id else "general",
                student_message=agent_message_content,
                category="free",
                subject_name=subject_name,
                session_id=str(session_id),
                location=req.location,
                preferences=req.preferences,
                action=req.action,
                history=history_list,
                is_big_topic_guest=is_big_topic,
                agenda_guest=agenda,
                current_index_guest=current_index,
                db=db
            )
            ai_content = ai_data.get("response", "No response generated.")
            
            res_payload = {
                "response": ai_content,
                "session_id": session_id,
                "topic_id": req.topic_id,
                "subject_id": req.subject_id,
                "is_big_topic": ai_data.get("is_big_topic"),
                "agenda": ai_data.get("agenda"),
                "current_index": ai_data.get("current_index"),
                "requires_action": ai_data.get("requires_action", []),
                "guest_credits_left": guest_credits_left
            }
            # Pass through structured tool-call data
            if ai_data.get("board"):
                res_payload["board"] = ai_data["board"]
            if ai_data.get("quiz"):
                res_payload["quiz"] = ai_data["quiz"]
            if ai_data.get("animation"):
                res_payload["animation"] = ai_data["animation"]
            if ai_data.get("plan"):
                res_payload["plan"] = ai_data["plan"]
            if ai_data.get("student_state_update"):
                res_payload["student_state_update"] = ai_data["student_state_update"]
            return res_payload
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # 2. Authenticated Flow (Stateful DB logging)
    try:
        session_id_int = int(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID for authenticated user")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id_int).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if current_user.tokens <= 0:
        raise HTTPException(status_code=403, detail="Not enough tokens. Please refer a friend to earn more!")
        
    try:
        current_user.tokens -= 1
        
        user_message_content = req.content
        agent_message_content = req.content
        
        if req.attachments:
            attachment_names = ", ".join([att.get("filename", "file") for att in req.attachments])
            user_message_content = f"📎 [Attached: {attachment_names}]\n\n" + req.content
            
            attachment_details = "\n\n--- ATTACHED FILE CONTEXT ---"
            for att in req.attachments:
                filename = att.get("filename", "file")
                preview = att.get("content_preview", "")
                attachment_details += f"\n\nFile Name: {filename}\nFile Content:\n{preview}\n-----------------------------"
            agent_message_content = req.content + attachment_details

        user_msg = models.ChatMessage(session_id=session_id_int, role="user", content=user_message_content)
        db.add(user_msg)
        db.commit()
        
        msg_count = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id_int, models.ChatMessage.role == "user").count()
        if msg_count == 1 and session.title == "New Chat":
            session.title = req.content[:50] + ("..." if len(req.content) > 50 else "")
            db.commit()
        
        student_id = req.student_id or current_user.id
        cleaned_msg = req.content.strip()
        ai_data = None
        if cleaned_msg.lower().startswith("search:"):
            query = cleaned_msg[7:].strip()
            res = research_manager.perform_dynamic_research(query)
            ai_content = res.get("synthesis", "Error performing research.")
        else:
            subject_name = None
            workspace_id = req.workspace_id
            
            subject_id = session.subject_id
            if session.topic_id and not subject_id:
                topic_db = db.query(models.Topic).filter(models.Topic.id == session.topic_id).first()
                if topic_db:
                    unit_db = db.query(models.Unit).filter(models.Unit.id == topic_db.unit_id).first()
                    if unit_db:
                        subject_id = unit_db.subject_id
                        session.subject_id = subject_id
                        db.commit()

            if subject_id:
                sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
                if sub:
                    subject_name = sub.name
                    mappings = db.query(models.SubjectGroupMapping).filter(models.SubjectGroupMapping.subject_id == sub.id).all()
                    group_ids = [m.group_id for m in mappings]
                    group_str = "-".join(map(str, sorted(group_ids))) if group_ids else "unassigned"
                    org_str = sub.org_id if sub.org_id is not None else "none"
                    workspace_id = f"org/{org_str}/groups/{group_str}/subjects/{subject_id}"

            ai_data = tutor_manager.get_tutor_response(
                workspace_id=workspace_id,
                student_id=student_id,
                topic_id=str(session.topic_id) if session.topic_id else "general",
                student_message=agent_message_content,
                category=session.category,
                subject_name=subject_name,
                session_id=str(session.id),
                location=req.location,
                preferences=req.preferences,
                action=req.action,
                db=db
            )
            ai_content = ai_data.get("response", "No response generated.")
        
        ai_msg = models.ChatMessage(session_id=session_id_int, role="ai", content=ai_content)
        db.add(ai_msg)
        
        session.updated_at = datetime.utcnow()
        if ai_data:
            if "agenda" in ai_data:
                import json
                session.agenda = json.dumps(ai_data["agenda"])
            if "current_index" in ai_data:
                session.current_index = ai_data["current_index"]
            if "is_big_topic" in ai_data:
                session.is_big_topic = ai_data["is_big_topic"]
                
        db.commit()

        res_payload = {
            "response": ai_content,
            "session_id": session_id_int,
            "topic_id": session.topic_id,
            "subject_id": session.subject_id
        }
        
        if ai_data and "requires_action" in ai_data:
            res_payload["requires_action"] = ai_data["requires_action"]
        
        # Pass through structured tool-call data
        if ai_data:
            if ai_data.get("board"):
                res_payload["board"] = ai_data["board"]
            if ai_data.get("quiz"):
                res_payload["quiz"] = ai_data["quiz"]
            if ai_data.get("animation"):
                res_payload["animation"] = ai_data["animation"]
            if ai_data.get("plan"):
                res_payload["plan"] = ai_data["plan"]
            if ai_data.get("student_state_update"):
                res_payload["student_state_update"] = ai_data["student_state_update"]
            
        if ai_data and req.location == "subject_chat" and session.subject_id:
            background_tasks.add_task(
                process_layer3_tracker,
                current_user.org_id,
                current_user.id,
                session.subject_id,
                session.topic_id,
                ai_data
            )

        if session.category == "subject" and session.subject_id:
            background_tasks.add_task(
                analyze_subject_chat_progress_background,
                session_id_int,
                current_user.id,
                session.subject_id
            )

        return res_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class QuizAnswerRequest(BaseModel):
    selected_index: int
    correct_index: int
    is_correct: bool
    question: str = ""
    concept_tested: str = ""

@app.post("/api/tutor/sessions/{session_id}/quiz-answer")
def submit_quiz_answer(session_id: str, req: QuizAnswerRequest, db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(get_current_user_optional)):
    """Accept a quiz answer from the frontend and store it in the student profile for the next LLM turn."""
    try:
        student_id = current_user.id if current_user else "guest"
        
        # Build quiz result summary for next-turn context
        result_text = f"{'Correct' if req.is_correct else 'Incorrect'} answer to: {req.question[:100]}"
        if req.concept_tested:
            result_text += f" (concept: {req.concept_tested})"
        
        if current_user:
            # Update the student profile with the quiz result
            workspace_id = str(current_user.org_id) if current_user.org_id else "default"
            profile = tutor_manager.load_student_profile(workspace_id, student_id)
            profile["last_quiz_result"] = result_text
            
            if not req.is_correct:
                mistakes = profile.setdefault("mistakes", [])
                mistakes.append({
                    "topic_id": req.concept_tested or "unknown",
                    "misconception": f"Wrong answer on quiz: {req.question[:100]}"
                })
                profile["mistakes"] = mistakes[-50:]
            
            tutor_manager.save_student_profile(workspace_id, student_id, profile)
        
        return {"ok": True, "recorded": result_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/tutor/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a chat session and all its messages."""
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"ok": True}

@app.put("/api/tutor/sessions/{session_id}/title")
def update_session_title(session_id: int, req: CreateSessionRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Rename a session."""
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = req.title
    db.commit()
    return {"ok": True, "title": session.title}

@app.get("/api/tutor/animations")
def get_tutor_animation(topic_id: str, topic_name: str = "Concept", workspace_id: str = "default", db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(get_current_user_optional)):
    """Fetch or generate a step-by-step animation for a topic."""
    try:
        org_id = str(current_user.org_id) if (current_user and current_user.org_id) else workspace_id
        animation = animation_manager.get_animation(org_id, topic_id, topic_name)
        return animation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import urllib.request
import urllib.parse
import re
import json

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")

@app.get("/api/yt-search")
def search_youtube(q: str = Query(...)):
    if YOUTUBE_API_KEY:
        try:
            api_url = f"https://www.googleapis.com/youtube/v3/search?part=snippet&q={urllib.parse.quote(q)}&maxResults=3&type=video&key={YOUTUBE_API_KEY}"
            req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
            res = urllib.request.urlopen(req)
            data = json.loads(res.read().decode('utf-8'))
            videos = []
            for item in data.get("items", []):
                if item.get("id", {}).get("kind") == "youtube#video":
                    videos.append({
                        "id": item["id"]["videoId"],
                        "title": item["snippet"]["title"]
                    })
            return {"videos": videos}
        except Exception as e:
            print(f"Official YT Search Error: {e}")
            # Fallback to scraping
            
    # Scraping Fallback
    url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(q)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        match = re.search(r'ytInitialData = ({.*?});</script>', html)
        if match:
            data = json.loads(match.group(1))
            videos = []
            contents = data['contents']['twoColumnSearchResultsRenderer']['primaryContents']['sectionListRenderer']['contents'][0]['itemSectionRenderer']['contents']
            for item in contents:
                if 'videoRenderer' in item:
                    vid = item['videoRenderer']
                    videos.append({
                        'id': vid['videoId'],
                        'title': vid['title']['runs'][0]['text']
                    })
                    if len(videos) >= 3:
                        break
            return {"videos": videos}
        return {"videos": []}
    except Exception as e:
        print(f"YT Search Error: {e}")
        return {"videos": []}


# --- TEACHER ROUTES ---

class ClassGroupCreate(BaseModel):
    subject_id: int
    name: str

@app.post('/api/teacher/classes')
def create_class(class_data: ClassGroupCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != 'teacher' and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='Only teachers can create classes')
    # Verify the subject exists and belongs to the user's organization
    sub = db.query(models.Subject).filter(
        models.Subject.id == class_data.subject_id,
        models.Subject.org_id == current_user.org_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    new_class = models.ClassGroup(
        org_id=current_user.org_id,
        teacher_id=current_user.id,
        subject_id=class_data.subject_id,
        name=class_data.name
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class

@app.get('/api/teacher/classes')
def get_classes(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != 'teacher' and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='Only teachers can view classes')
    classes = db.query(models.ClassGroup).filter(models.ClassGroup.teacher_id == current_user.id, models.ClassGroup.org_id == current_user.org_id).all()
    # also fetch student count and subject name for each class
    result = []
    for c in classes:
        student_count = db.query(models.StudentClass).filter(models.StudentClass.class_id == c.id).count()
        subject = db.query(models.Subject).filter(models.Subject.id == c.subject_id).first()
        result.append({
            'id': c.id,
            'name': c.name,
            'subject_name': subject.name if subject else 'Unknown',
            'student_count': student_count,
            'created_at': c.created_at
        })
    return result

@app.get('/api/teacher/classes/{class_id}/analytics')
def get_class_analytics(class_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != 'teacher' and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='Only teachers can view analytics')
    
    # Verify the class exists and belongs to the teacher's organization
    c = db.query(models.ClassGroup).filter(
        models.ClassGroup.id == class_id,
        models.ClassGroup.org_id == current_user.org_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class group not found")
        
    # If the user is a teacher, they must own the class group
    if current_user.role == 'teacher' and c.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this class group")
    
    # get students in class
    students = db.query(models.StudentClass).filter(models.StudentClass.class_id == class_id).all()
    
    student_data = []
    for s in students:
        u = db.query(models.User).filter(models.User.id == s.student_id).first()
        if u:
            student_data.append({
                'id': u.id,
                'name': u.name,
                'email': u.email,
                'progress': u.overall_progress,
                'learning_hours': u.learning_hours_this_week
            })
            
    # fake general analytics for the class
    class_avg_progress = sum([s['progress'] for s in student_data]) / len(student_data) if student_data else 0
    class_avg_hours = sum([s['learning_hours'] for s in student_data]) / len(student_data) if student_data else 0
    
    return {
        'students': student_data,
        'average_progress': class_avg_progress,
        'average_hours': class_avg_hours
    }

class SyllabusCreate(BaseModel):
    title: str
    content: str

@app.post('/api/teacher/classes/{class_id}/syllabus')
def create_syllabus(class_id: int, syllabus_data: SyllabusCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != 'teacher' and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='Only teachers can create syllabus')
        
    # Verify the class exists and belongs to the teacher's organization
    c = db.query(models.ClassGroup).filter(
        models.ClassGroup.id == class_id,
        models.ClassGroup.org_id == current_user.org_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class group not found")
        
    # If the user is a teacher, they must own the class group
    if current_user.role == 'teacher' and c.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this class group")
        
    s = db.query(models.Syllabus).filter(models.Syllabus.class_id == class_id).first()
    if s:
        s.title = syllabus_data.title
        s.content = syllabus_data.content
    else:
        s = models.Syllabus(
            class_id=class_id,
            title=syllabus_data.title,
            content=syllabus_data.content
        )
        db.add(s)
    db.commit()
    db.refresh(s)
    return s

@app.get('/api/teacher/classes/{class_id}/syllabus')
def get_syllabus(class_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify the class exists and belongs to the teacher's organization
    c = db.query(models.ClassGroup).filter(
        models.ClassGroup.id == class_id,
        models.ClassGroup.org_id == current_user.org_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class group not found")
        
    # If the user is a teacher, they must own the class group
    if current_user.role == 'teacher' and c.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this class group")

    s = db.query(models.Syllabus).filter(models.Syllabus.class_id == class_id).first()
    if not s:
        return {'title': '', 'content': ''}
    return s


class OrgSettingsUpdate(BaseModel):
    name: str
    current_semester: str

@app.put("/api/org/settings")
def update_org_settings(req: OrgSettingsUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.id == current_user.org_id).first()
    if org:
        org.name = req.name
        org.current_semester = req.current_semester
        db.commit()
    return {"ok": True}

class DeptCreate(BaseModel):
    name: str

@app.post("/api/org/departments")
def create_org_dept(req: DeptCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    dept = models.Department(name=req.name, org_id=current_user.org_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"ok": True, "id": dept.id, "name": dept.name, "status": dept.status, "student_count": dept.student_count, "teacher_count": dept.teacher_count, "progress_percent": dept.progress_percent}

class StaffCreate(BaseModel):
    name: str
    email: str
    department_id: Optional[int] = None
    designation: Optional[str] = None
    role: str = "teacher"

@app.get("/api/org/staff")
def get_org_staff(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    staff_users = db.query(models.User).filter(models.User.role.in_(["teacher", "admin", "clg"]), models.User.org_id == current_user.org_id).all()
    res = []
    for u in staff_users:
        dept_name = None
        designation = None
        if u.staff_profile:
            designation = u.staff_profile.designation
            if u.staff_profile.department_id:
                d = db.query(models.Department).filter(models.Department.id == u.staff_profile.department_id).first()
                if d: dept_name = d.name
        res.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "designation": designation,
            "department": dept_name
        })
    return res

@app.post("/api/org/staff")
def create_org_staff(req: StaffCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    import uuid
    new_id = str(uuid.uuid4())
    org_id = current_user.org_id
    u = models.User(id=new_id, email=req.email, name=req.name, role=req.role, org_id=org_id)
    db.add(u)
    db.commit()
    
    s = models.Staff(user_id=new_id, org_id=org_id, department_id=req.department_id, designation=req.designation, employee_id=new_id[:8])
    db.add(s)
    db.commit()
    return {"ok": True, "id": new_id}

# --- Assessments ---
class AssessmentGenerateRequest(BaseModel):
    topic_id: str
    topic_name: str
    workspace_id: str = "default"
    
class AssessmentSubmitRequest(BaseModel):
    topic_id: str
    answers: dict
    workspace_id: str = "default"

@app.get("/api/assessments/topics")
def get_assessment_topics(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    topics = db.query(models.Topic).filter(models.Topic.org_id == current_user.org_id).all()
    profile = tutor_manager.load_student_profile("default", current_user.id)
    weak_concepts = profile.get("weak_concepts", [])
    
    res = []
    for t in topics:
        mapping = db.query(models.UserTopicMapping).filter(
            models.UserTopicMapping.user_id == current_user.id,
            models.UserTopicMapping.topic_id == t.id
        ).first()
        status = mapping.status if mapping else "locked"
        mastery_level = mapping.mastery_level if mapping else 0.0
        
        if status in ["active", "completed"] or str(t.id) in weak_concepts:
            unit = db.query(models.Unit).filter(models.Unit.id == t.unit_id).first()
            sub_name = ""
            if unit:
                sub = db.query(models.Subject).filter(models.Subject.id == unit.subject_id).first()
                if sub: sub_name = sub.name
            
            res.append({
                "id": str(t.id),
                "name": t.name,
                "subject_name": sub_name,
                "status": status,
                "mastery_level": profile.get("mastery", {}).get(str(t.id), mastery_level),
                "is_weak": str(t.id) in weak_concepts
            })
    return res

@app.post("/api/assessments/generate")
def generate_assessment(req: AssessmentGenerateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    result = evaluation_manager.generate_assessment(str(current_user.org_id), current_user.id, req.topic_id, req.topic_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/assessments/submit")
def submit_assessment(req: AssessmentSubmitRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    result = evaluation_manager.submit_assessment(str(current_user.org_id), current_user.id, req.topic_id, req.answers)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    # Sync mastery to UserTopicMapping DB if topic exists
    if "new_mastery" in result:
        try:
            tid = int(req.topic_id)
            topic = db.query(models.Topic).filter(models.Topic.id == tid).first()
            if topic:
                mapping = db.query(models.UserTopicMapping).filter(
                    models.UserTopicMapping.user_id == current_user.id,
                    models.UserTopicMapping.topic_id == tid
                ).first()
                if not mapping:
                    mapping = models.UserTopicMapping(
                        user_id=current_user.id,
                        topic_id=tid
                    )
                    db.add(mapping)
                mapping.mastery_level = float(result["new_mastery"])
                if float(result["new_mastery"]) >= 70:
                    mapping.status = "completed"
                elif float(result["new_mastery"]) > 0 and mapping.status == "locked":
                    mapping.status = "active"
                db.commit()
        except ValueError:
            pass
            
    return result
    
@app.get("/api/assessments/history")
def get_assessment_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    profile = tutor_manager.load_student_profile("default", current_user.id)
    history = profile.get("assessment_history", [])
    mistakes = profile.get("mistakes", [])
    
    # Enrich with topic names
    for h in history:
        try:
            tid = int(h["topic_id"])
            t = db.query(models.Topic).filter(models.Topic.id == tid).first()
            h["topic_name"] = t.name if t else "Unknown Topic"
        except Exception:
            h["topic_name"] = "Unknown Topic"
            
    for m in mistakes:
        try:
            tid = int(m["topic_id"])
            t = db.query(models.Topic).filter(models.Topic.id == tid).first()
            m["topic_name"] = t.name if t else "Unknown Topic"
        except Exception:
            m["topic_name"] = "Unknown Topic"
            
    return {
        "history": sorted(history, key=lambda x: x.get("timestamp", ""), reverse=True),
        "mistakes": mistakes
    }

# --- PROJECTS SYSTEM ---

class ProjectCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None

class ProjectUpdateRequest(BaseModel):
    status: Optional[str] = None
    progress_percent: Optional[float] = None
    title: Optional[str] = None
    description: Optional[str] = None

class ProjectMessageRequest(BaseModel):
    content: str
    workspace_id: str = "default"

@app.get("/api/projects")
def get_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    projects = db.query(models.Project).filter(models.Project.user_id == current_user.id).order_by(models.Project.updated_at.desc()).all()
    return [{
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "status": p.status,
        "progress_percent": p.progress_percent,
        "created_at": str(p.created_at),
        "updated_at": str(p.updated_at)
    } for p in projects]

@app.post("/api/projects")
def create_project(req: ProjectCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = models.Project(
        user_id=current_user.id,
        title=req.title,
        description=req.description
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "status": p.status,
        "progress_percent": p.progress_percent
    }

@app.get("/api/projects/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.Project).filter(models.Project.id == project_id, models.Project.user_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "status": p.status,
        "progress_percent": p.progress_percent,
        "created_at": str(p.created_at),
        "updated_at": str(p.updated_at)
    }

@app.put("/api/projects/{project_id}")
def update_project(project_id: int, req: ProjectUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.Project).filter(models.Project.id == project_id, models.Project.user_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if req.status is not None:
        p.status = req.status
    if req.progress_percent is not None:
        p.progress_percent = req.progress_percent
    if req.title is not None:
        p.title = req.title
    if req.description is not None:
        p.description = req.description
        
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return {"ok": True}

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.Project).filter(models.Project.id == project_id, models.Project.user_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()
    return {"ok": True}

@app.get("/api/projects/{project_id}/messages")
def get_project_messages(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.Project).filter(models.Project.id == project_id, models.Project.user_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    msgs = db.query(models.ProjectMessage).filter(models.ProjectMessage.project_id == project_id).order_by(models.ProjectMessage.timestamp).all()
    return [{"id": m.id, "role": m.role, "content": m.content, "timestamp": str(m.timestamp)} for m in msgs]

@app.post("/api/projects/{project_id}/messages")
def send_project_message(project_id: int, req: ProjectMessageRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.Project).filter(models.Project.id == project_id, models.Project.user_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Save user message
    user_msg = models.ProjectMessage(project_id=project_id, role="user", content=req.content)
    db.add(user_msg)
    db.commit()
    
    # Update AI mentor manager (sync local state)
    ai_response = project_mentor_manager.get_mentor_response(
        workspace_id=str(current_user.org_id),
        student_id=current_user.id,
        project_id=str(project_id),
        student_message=req.content
    )
    ai_content = ai_response.get("response", "")
    
    # Update project state based on local state if needed
    proj_data = ai_response.get("project_data", {})
    if proj_data.get("phase"):
        p.status = proj_data.get("phase")
        
    p.updated_at = datetime.utcnow()
    
    # Save AI message
    ai_msg = models.ProjectMessage(project_id=project_id, role="ai", content=ai_content)
    db.add(ai_msg)
    db.commit()
    
    return {
        "response": ai_content,
        "project_status": p.status
    }

@app.get("/api/tutor/guest/credits")
def get_guest_credits(device_id: str = Query(...), db: Session = Depends(get_db)):
    """Fetch remaining guest credits for a device."""
    guest_dev = db.query(models.GuestDevice).filter(models.GuestDevice.device_id == device_id).first()
    if not guest_dev:
        guest_dev = models.GuestDevice(device_id=device_id, credits=10)
        db.add(guest_dev)
        db.commit()
        db.refresh(guest_dev)
    return {"credits_left": guest_dev.credits}

EDGE_TTS_AVAILABLE = True

@app.get("/api/tts")
async def text_to_speech_endpoint(text: str = Query(...), return_words: bool = Query(False)):
    """Convert text to speech and return audio stream using edge-tts with automatic gTTS fallback."""
    global EDGE_TTS_AVAILABLE
    from fastapi.responses import Response, JSONResponse
    import base64

    # 1. Try edge-tts first if not previously failed/blocked
    if EDGE_TTS_AVAILABLE:
        try:
            import edge_tts
            communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
            audio_data = b""
            word_boundaries = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
                elif chunk["type"] == "WordBoundary":
                    word_boundaries.append({
                        "text": chunk.get("text", ""),
                        "offset": chunk.get("offset", 0) / 10_000_000.0,
                        "duration": chunk.get("duration", 0) / 10_000_000.0,
                    })
            if audio_data:
                if return_words:
                    return JSONResponse(content={
                        "audio_base64": base64.b64encode(audio_data).decode("utf-8"),
                        "words": word_boundaries,
                        "media_type": "audio/mpeg"
                    })
                return Response(content=audio_data, media_type="audio/mpeg")
        except Exception as e:
            print(f"[TTS] edge-tts service unavailable ({e}), permanently switching to gTTS for this session...")
            EDGE_TTS_AVAILABLE = False

    # 2. Fast, reliable gTTS fallback
    try:
        from gtts import gTTS
        import io
        fp = io.BytesIO()
        tts = gTTS(text=text, lang="en", tld="co.uk")
        tts.write_to_fp(fp)
        raw_val = fp.getvalue()
        if return_words:
            return JSONResponse(content={
                "audio_base64": base64.b64encode(raw_val).decode("utf-8"),
                "words": [],
                "media_type": "audio/mpeg"
            })
        return Response(content=raw_val, media_type="audio/mpeg")
    except Exception as e:
        print(f"[TTS] gTTS error: {e}")
        raise HTTPException(status_code=400, detail=f"TTS error: {str(e)}")


from agent.core.state import StateManager, SessionState
from agent.core.professor_agent import UnifiedProfessorAgent, ProfessorStepResult
from agent.core.lesson_planner import LessonPlanner
from dataclasses import asdict

professor_state_manager = StateManager()
unified_professor_agent = UnifiedProfessorAgent(state_manager=professor_state_manager)
lesson_planner = LessonPlanner()


class SimulateBoardStepRequest(BaseModel):
    session_id: Optional[str] = "sim_default"
    step_index: int = 0
    speech: str = ""
    gesture: Optional[str] = "explain"
    board_writes: List[Dict[str, Any]] = []
    yield_decision: Optional[str] = "continue"
    question: Optional[str] = None
    reset_state: Optional[bool] = False


@app.post("/api/tutor/simulate")
def simulate_board_step(req: SimulateBoardStepRequest):
    """
    Simulates a chalkboard teaching step without calling an LLM.
    Accepts arbitrary text and voice, applies board writes, resolves collisions,
    and returns the exact synchronized frontend payload for testing layout, states, and highlighting.
    """
    sess_id = req.session_id or "sim_default"
    if req.reset_state:
        state = professor_state_manager.load_or_create_session(sess_id)
        state.nodes = []
        state.overlays = []
        state.connections = []
        state.events = []
        state.step_counter = 0
        state.plan = None
        state.plan_current_index = 0
        professor_state_manager.save(state)

    state = professor_state_manager.load_or_create_session(sess_id)

    step_result = ProfessorStepResult(
        board_writes=req.board_writes,
        speech=req.speech,
        gesture=req.gesture or "explain",
        yield_decision=req.yield_decision or "continue",
        question=req.question
    )

    modified_nodes = unified_professor_agent.apply_step_to_state(state, step_result)
    professor_state_manager.save(state)
    professor_state_manager.save_step(
        session_id=sess_id,
        step_index=req.step_index,
        board_action=step_result.board_writes,
        speech=step_result.speech,
        gesture=step_result.gesture,
        yield_dec=step_result.yield_decision
    )

    speech = req.speech or "Let's observe the chalkboard."
    if req.question and req.question.strip() and req.question.strip() not in speech:
        speech = f"{speech} {req.question.strip()}"

    elements = []
    for node in state.nodes:
        elements.append({
            "id": node.id,
            "type": node.kind if node.kind in ["equation", "heading", "step", "scratchpad", "box", "text", "code", "diagram", "asset"] else "concept_node",
            "content": node.content,
            "label": node.content,
            "role": node.role,
            "zone_id": node.zone,
            "step_num": node.step_num,
            "w": node.w,
            "h": node.h,
            "spatial_intent": node.spatial_intent
        })

    raw_sentences = [s.strip() for s in re.split(r'(?<=[.?!])\s+', speech) if s.strip()]
    if not raw_sentences:
        raw_sentences = [speech]

    num_elements = len(elements)
    num_sentences = max(1, len(raw_sentences))
    for elem_idx, elem in enumerate(elements):
        assigned_speech_idx = min(num_sentences - 1, int((elem_idx / max(1, num_elements)) * num_sentences))
        elem["appear_at"] = assigned_speech_idx

    speech_sequence = []
    anim_cycle = ["explain", "point_board", "think", "encourage"]
    for s_idx, sentence in enumerate(raw_sentences):
        sync_target_id = None
        for el in elements:
            if el.get("appear_at") == s_idx:
                sync_target_id = el["id"]
                break

        speech_sequence.append({
            "text": sentence,
            "voice_id": "default",
            "sync_with": sync_target_id
        })

    payload = {
        "type": "OrchestratedTeachStep",
        "step_index": req.step_index,
        "intent": {
            "intent": "teach",
            "socratic_check": req.question,
            "yield": req.yield_decision
        },
        "board": {
            "elements": elements,
            "nodes": [asdict(n) for n in state.nodes],
            "overlays": [asdict(o) for o in state.overlays],
            "connections": [asdict(c) for c in state.connections],
            "modified_nodes": modified_nodes,
            "canvas_w": state.canvas_w,
            "canvas_h": state.canvas_h
        },
        "voice": {
            "speech_sequence": speech_sequence,
            "gesture": req.gesture or "explain"
        },
        "model": {
            "animations": [{"animation": req.gesture or "explain", "sync_with_speech_index": 0}],
            "gesture": req.gesture or "explain"
        },
        "plan": state.plan
    }

    persistence_content = speech + f"\n\n```component\n{json.dumps(payload)}\n```"

    return {
        "response": persistence_content,
        "board": payload["board"],
        "voice": payload["voice"],
        "model": payload["model"],
        "payload": payload,
        "session_id": sess_id,
        "step_index": req.step_index,
        "yield": req.yield_decision
    }


@app.websocket("/ws/teach/{session_id}")
async def websocket_teach_endpoint(websocket: WebSocket, session_id: str, db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        # 1. Receive handshake/init message
        init_data = await websocket.receive_json()
        canvas_w = init_data.get("canvas_w", 1000)
        canvas_h = init_data.get("canvas_h", 650)
        subject = init_data.get("subject", "Mathematics")
        topic = init_data.get("topic", "General")

        state = professor_state_manager.load_or_create_session(
            session_id=session_id,
            subject=subject,
            topic=topic,
            canvas_w=canvas_w,
            canvas_h=canvas_h
        )

        # Send initial state ack
        await websocket.send_json({
            "type": "init_ack",
            "session_id": session_id,
            "board": {
                "nodes": [asdict(n) for n in state.nodes],
                "overlays": [asdict(o) for o in state.overlays],
                "connections": [asdict(c) for c in state.connections],
                "canvas_w": state.canvas_w,
                "canvas_h": state.canvas_h
            },
            "plan": state.plan
        })

        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type", "message")

            if msg_type in ["message", "start_teaching", "answer"]:
                student_message = msg.get("content") or msg.get("text") or None
                if student_message:
                    state.add_event("student", "message", student_message)

                step_index = 0

                # Upfront Lesson Planning if not already created
                if not state.plan:
                    try:
                        plan = lesson_planner.generate_lesson_plan(
                            topic=state.topic,
                            subject=state.subject,
                            student_query=student_message
                        )
                        state.set_plan(plan)
                        professor_state_manager.save(state)
                        await websocket.send_json({
                            "type": "lesson_plan",
                            "session_id": session_id,
                            "plan": state.plan
                        })
                    except Exception as e:
                        logger.warning(f"Could not generate lesson plan: {e}")

                plan_guidance = state.get_plan_summary()
                subtopics = state.plan.get("subtopics", []) if state.plan else []
                plan_len = len(subtopics) if subtopics else 10
                safety_max_steps = max(35, plan_len + 2)

                while step_index < safety_max_steps:
                    # Build conversational speech history
                    recent_history = []
                    for ev in state.event_log[-12:]:
                        if ev.type == "message" and ev.payload:
                            recent_history.append({"role": "user" if ev.sender == "student" else "assistant", "content": str(ev.payload)})

                    # Run single step
                    step_result = unified_professor_agent.run_turn_step(
                        state=state,
                        student_message=student_message if step_index == 0 else None,
                        step_index=step_index,
                        guidance=plan_guidance,
                        history=recent_history
                    )

                    # Apply writes to hot state
                    modified_nodes = unified_professor_agent.apply_step_to_state(state, step_result)
                    if step_result.board_writes or (step_result.speech and len(step_result.speech.strip()) > 10):
                        state.advance_plan()

                    # Persist hot state
                    professor_state_manager.save(state)
                    professor_state_manager.save_step(
                        session_id=session_id,
                        step_index=step_index,
                        board_action=step_result.board_writes,
                        speech=step_result.speech,
                        gesture=step_result.gesture,
                        yield_dec=step_result.yield_decision
                    )

                    # Emit real-time frame
                    await websocket.send_json({
                        "type": "professor_step",
                        "step_index": step_index,
                        "board": {
                            "nodes": [asdict(n) for n in state.nodes],
                            "overlays": [asdict(o) for o in state.overlays],
                            "connections": [asdict(c) for c in state.connections],
                            "modified_nodes": modified_nodes,
                            "canvas_w": state.canvas_w,
                            "canvas_h": state.canvas_h
                        },
                        "speech": step_result.speech,
                        "gesture": step_result.gesture,
                        "yield": step_result.yield_decision,
                        "question": step_result.question,
                        "plan": state.plan
                    })

                    if step_result.yield_decision in ["yield", "ask"]:
                        break

                    step_index += 1

                # Turn finished
                await websocket.send_json({"type": "turn_done", "plan": state.plan})
                professor_state_manager.sync_to_postgres(session_id, db)

    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected for session: {session_id}")
    except Exception as e:
        print(f"[WebSocket] Error in teaching session {session_id}: {e}")


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)

 
 
