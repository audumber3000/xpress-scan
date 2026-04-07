import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from sqlalchemy import text
from database import engine

def run():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN discount FLOAT DEFAULT 0.0;"))
            print("Added discount")
        except Exception as e:
            print(f"Failed discount: {e}")
            
        try:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN discount_type VARCHAR DEFAULT 'amount';"))
            print("Added discount_type")
        except Exception as e:
            print(f"Failed discount_type: {e}")
            
        try:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN discount_amount FLOAT DEFAULT 0.0;"))
            print("Added discount_amount")
        except Exception as e:
            print(f"Failed discount_amount: {e}")
            
        conn.commit()
    print("Migration complete")

if __name__ == '__main__':
    run()
