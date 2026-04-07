import os
import sys
import glob

# Add backend dir to path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, SessionLocal
from models import Base, ClinicalAsset
from domains.infrastructure.services.r2_storage import _get_r2_client

def setup_anatomy_assets():
    # 1. Create table if it doesn't exist
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # 2. Check if we have R2 credentials
    client = _get_r2_client()
    if not client:
        print("❌ Error: R2 client not configured. Check your .env variables (R2_ACCESS_KEY_ID, etc).")
        return
        
    bucket_name = os.getenv("R2_BUCKET_NAME")
    if not bucket_name:
        print("❌ Error: R2_BUCKET_NAME not set.")
        return

    # 3. Find files
    assets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Assets")
    png_files = glob.glob(os.path.join(assets_dir, "*.png"))
    
    if not png_files:
        print(f"❌ No .png files found in {assets_dir}")
        return
        
    print(f"Found {len(png_files)} anatomy assets to migrate.")
    
    for filepath in png_files:
        filename = os.path.basename(filepath)
        # Extract name without extension and convert underscores to spaces for UI display name later
        # e.g. 'Both_TMJ.png' -> 'Both TMJ' or 'Buccal Mucosa.png' -> 'Buccal Mucosa'
        name = filename.replace('.png', '').replace('_', ' ')
        
        # Consistent key naming: global/anatomy/Both_TMJ.png
        # Convert spaces to underscores for the key to maintain clean URLs
        safe_filename = filename.replace(' ', '_')
        storage_key = f"global/anatomy/{safe_filename}"
        
        # Upload to R2
        print(f"Uploading '{name}' to R2 -> {storage_key} ...")
        try:
            with open(filepath, 'rb') as file:
                client.upload_fileobj(
                    file,
                    bucket_name,
                    storage_key,
                    ExtraArgs={'ContentType': 'image/png'}
                )
        except Exception as e:
            print(f"❌ Failed to upload {filename}: {e}")
            continue
            
        # Update Database
        existing = db.query(ClinicalAsset).filter(ClinicalAsset.name == name).first()
        if existing:
            print(f"Updating existing DB record for {name}...")
            existing.r2_storage_key = storage_key
        else:
            print(f"Creating new DB record for {name}...")
            new_asset = ClinicalAsset(
                name=name,
                category="anatomy",
                r2_storage_key=storage_key
            )
            db.add(new_asset)
            
        db.commit()
    
    print("✅ Successfully completed asset migration to R2 and populated Database!")
    db.close()

if __name__ == "__main__":
    setup_anatomy_assets()
