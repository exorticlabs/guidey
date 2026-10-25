from database import engine, Base
from models import Organization, OrganizationGroup, OrganizationMemory, GroupMemory, StudentMemory
import sys

print("Initializing Supabase Postgres tables...")
try:
    Base.metadata.create_all(bind=engine)
    print("Successfully created all database tables in Supabase Postgres!")
except Exception as e:
    print(f"Error creating tables: {e}")
    sys.exit(1)
