import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/postgres")

engine = create_engine(DATABASE_URL)

def migrate():
    print(f"Connecting to database to add clinical snapshot columns...")
    columns_to_add = [
        ("dental_chart_snapshot", "JSON"),
        ("treatment_plan_snapshot", "JSON"),
        ("tooth_notes_snapshot", "JSON")
    ]
    
    with engine.connect() as conn:
        for col_name, col_type in columns_to_add:
            try:
                print(f"Checking '{col_name}' column in 'case_papers'...")
                # Check if column exists
                query = text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='case_papers' AND column_name='{col_name}';
                """)
                res = conn.execute(query).fetchone()
                
                if not res:
                    print(f"Adding '{col_name}' column...")
                    conn.execute(text(f"ALTER TABLE case_papers ADD COLUMN {col_name} {col_type};"))
                    conn.commit()
                    print(f"✅ Successfully added '{col_name}' column.")
                else:
                    print(f"✅ '{col_name}' column already exists.")
            except Exception as e:
                print(f"Error adding {col_name} column: {e}")
        
        print("\nMigration complete.")

if __name__ == "__main__":
    migrate()
