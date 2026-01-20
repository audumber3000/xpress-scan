import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_and_fix_user_clinic():
    """Check if users have clinic_id and help fix it"""
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL or SUPABASE_URL environment variable not set")
        return
    
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        with connection.begin():
            try:
                # Get all users
                users = connection.execute(text("""
                    SELECT id, email, name, role, clinic_id 
                    FROM users 
                    ORDER BY id
                """))
                
                print("\n=== User Clinic Status ===\n")
                users_list = users.fetchall()
                
                if not users_list:
                    print("No users found in database.")
                    return
                
                for user in users_list:
                    user_id, email, name, role, clinic_id = user
                    status = "✅ Has clinic" if clinic_id else "❌ No clinic"
                    print(f"User ID: {user_id}")
                    print(f"  Email: {email}")
                    print(f"  Name: {name}")
                    print(f"  Role: {role}")
                    print(f"  Clinic ID: {clinic_id} {status}")
                    print()
                
                # Check if there are any clinics
                clinics = connection.execute(text("""
                    SELECT id, name 
                    FROM clinics 
                    ORDER BY id
                """))
                
                clinics_list = clinics.fetchall()
                print(f"\n=== Available Clinics ({len(clinics_list)}) ===\n")
                
                if clinics_list:
                    for clinic in clinics_list:
                        clinic_id, clinic_name = clinic
                        print(f"  Clinic ID: {clinic_id} - {clinic_name}")
                else:
                    print("  No clinics found in database.")
                    print("\n  💡 You may need to complete onboarding to create a clinic.")
                
                # Check users without clinic_id
                users_without_clinic = [u for u in users_list if not u[4]]
                if users_without_clinic:
                    print(f"\n⚠️  Found {len(users_without_clinic)} user(s) without clinic_id:")
                    for user in users_without_clinic:
                        print(f"  - {user[2]} ({user[1]}) - ID: {user[0]}")
                    
                    if clinics_list:
                        print(f"\n💡 To assign a clinic to a user, run:")
                        print(f"   UPDATE users SET clinic_id = <clinic_id> WHERE id = <user_id>;")
                    else:
                        print(f"\n💡 You need to create a clinic first, then assign it to users.")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    check_and_fix_user_clinic()





