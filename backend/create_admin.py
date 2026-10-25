import os
import sys
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client, Client
from database import SessionLocal
from models import User

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in your .env file.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    password = os.environ.get("ADMIN_PASSWORD", "AdminPass123!")
    name = os.environ.get("ADMIN_NAME", "Administrator")
    
    print(f"Creating user {email} in Supabase...")
    try:
        res = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        
        user_id = None
        if res.user:
            user_id = res.user.id
            print(f"User created in Supabase with ID: {user_id}")
        else:
            print("Failed to get user from Supabase response.")
            return
            
        # Add to local DB
        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.id == user_id).first()
            if not existing:
                print("Inserting admin user into local database...")
                admin_user = User(
                    id=user_id,
                    email=email,
                    name=name,
                    role="admin"
                )
                db.add(admin_user)
                db.commit()
                print("Admin user successfully created in local database!")
            else:
                existing.role = "admin"
                db.commit()
                print("User already existed in local DB. Updated role to 'admin'.")
        except Exception as e:
            db.rollback()
            print(f"Database error: {e}")
        finally:
            db.close()
            
    except Exception as e:
        print(f"Supabase auth error: {e}")

if __name__ == "__main__":
    create_admin()
