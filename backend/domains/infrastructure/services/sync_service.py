"""
Sync Service - Handles bidirectional sync between local and cloud databases
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

# Cloud database URL (for sync operations) - uses DATABASE_URL from .env
DATABASE_URL = os.environ.get("DATABASE_URL")

# Tables to sync (in order of dependencies)
SYNC_TABLES = [
    'clinics',
    'users',
    'patients',
    'treatment_types',
    'referring_doctors',
    'appointments',
    'payments',
    'reports',
    'xray_images',
    'invoices',
    'invoice_line_items',
    'invoice_audit_logs',
    'subscriptions',
    'scheduled_messages',
    'attendance'
]

def get_cloud_db():
    """Get cloud database session"""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable required for cloud sync")
    
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

def get_local_db():
    """Get local database session"""
    from database import SessionLocal
    return SessionLocal()

def get_last_sync_time(table_name: str, user_id: int, clinic_id: int, db) -> Optional[datetime]:
    """Get the last sync time for a table from the most recently synced record"""
    try:
        result = db.execute(text(f"""
            SELECT MAX(synced_at) as last_sync
            FROM {table_name}
            WHERE clinic_id = :clinic_id
            AND synced_at IS NOT NULL
        """), {"clinic_id": clinic_id})
        
        row = result.fetchone()
        return row[0] if row and row[0] else None
    except Exception as e:
        print(f"Error getting last sync time for {table_name}: {e}")
        return None

def pull_from_cloud(table_name: str, user_id: int, clinic_id: int, last_sync: Optional[datetime]) -> List[Dict[str, Any]]:
    """Pull changes from cloud database"""
    try:
        cloud_db = get_cloud_db()
        
        # Build query to get records updated since last sync
        if last_sync:
            query = text(f"""
                SELECT * FROM {table_name}
                WHERE clinic_id = :clinic_id
                AND updated_at > :last_sync
                ORDER BY updated_at ASC
            """)
            result = cloud_db.execute(query, {"clinic_id": clinic_id, "last_sync": last_sync})
        else:
            # First sync - get all records
            query = text(f"""
                SELECT * FROM {table_name}
                WHERE clinic_id = :clinic_id
                ORDER BY updated_at ASC
            """)
            result = cloud_db.execute(query, {"clinic_id": clinic_id})
        
        records = []
        for row in result:
            # Convert row to dict
            record = dict(row._mapping)
            records.append(record)
        
        cloud_db.close()
        return records
    except Exception as e:
        print(f"Error pulling from cloud for {table_name}: {e}")
        return []

def push_to_cloud(table_name: str, user_id: int, clinic_id: int, last_sync: Optional[datetime]) -> List[Dict[str, Any]]:
    """Push changes to cloud database - returns records that need to be pushed"""
    try:
        local_db = get_local_db()
        
        # Get records that need to be synced (updated but not synced, or updated after last sync)
        if last_sync:
            query = text(f"""
                SELECT * FROM {table_name}
                WHERE clinic_id = :clinic_id
                AND (synced_at IS NULL OR updated_at > synced_at)
                ORDER BY updated_at ASC
            """)
            result = local_db.execute(query, {"clinic_id": clinic_id})
        else:
            # First sync - get all records
            query = text(f"""
                SELECT * FROM {table_name}
                WHERE clinic_id = :clinic_id
                ORDER BY updated_at ASC
            """)
            result = local_db.execute(query, {"clinic_id": clinic_id})
        
        records = []
        for row in result:
            record = dict(row._mapping)
            records.append(record)
        
        local_db.close()
        return records
    except Exception as e:
        print(f"Error pushing to cloud for {table_name}: {e}")
        return []

def resolve_conflicts(local_record: Dict[str, Any], cloud_record: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve conflicts using last-write-wins strategy"""
    local_updated = local_record.get('updated_at')
    cloud_updated = cloud_record.get('updated_at')
    
    # Convert to datetime if they're strings
    if isinstance(local_updated, str):
        local_updated = datetime.fromisoformat(local_updated.replace('Z', '+00:00'))
    if isinstance(cloud_updated, str):
        cloud_updated = datetime.fromisoformat(cloud_updated.replace('Z', '+00:00'))
    
    # Last write wins - use the record with the newer updated_at
    if cloud_updated and local_updated:
        if cloud_updated > local_updated:
            return cloud_record  # Cloud is newer
        else:
            return local_record  # Local is newer or equal (prefer local)
    elif cloud_updated:
        return cloud_record
    else:
        return local_record

def sync_table(table_name: str, user_id: int, clinic_id: int) -> Dict[str, Any]:
    """Sync a single table bidirectionally"""
    local_db = get_local_db()
    cloud_db = get_cloud_db()
    
    stats = {
        "table": table_name,
        "pulled": 0,
        "pushed": 0,
        "conflicts": 0,
        "errors": []
    }
    
    try:
        # Get last sync time
        last_sync = get_last_sync_time(table_name, user_id, clinic_id, local_db)
        
        # Pull changes from cloud
        cloud_changes = pull_from_cloud(table_name, user_id, clinic_id, last_sync)
        
        # Push changes to cloud (get local changes)
        local_changes = push_to_cloud(table_name, user_id, clinic_id, last_sync)
        
        # Apply cloud changes to local (upsert)
        for cloud_record in cloud_changes:
            record_id = cloud_record.get('id')
            if not record_id:
                continue
            
            try:
                # Check if record exists locally
                check_query = text(f"SELECT id, updated_at FROM {table_name} WHERE id = :id AND clinic_id = :clinic_id")
                local_existing = local_db.execute(check_query, {"id": record_id, "clinic_id": clinic_id}).fetchone()
                
                if local_existing:
                    # Conflict - resolve using last-write-wins
                    local_record = dict(local_existing._mapping)
                    resolved = resolve_conflicts(local_record, cloud_record)
                    
                    if resolved == cloud_record:
                        # Update local with cloud record
                        update_fields = []
                        update_values = {}
                        
                        for key, value in cloud_record.items():
                            if key not in ['id', 'clinic_id']:  # Don't update ID or clinic_id
                                update_fields.append(f"{key} = :{key}")
                                update_values[key] = value
                        
                        update_values['synced_at'] = datetime.utcnow()
                        update_values['sync_status'] = 'synced'
                        update_values['id'] = record_id
                        update_values['clinic_id'] = clinic_id
                        
                        update_query = text(f"""
                            UPDATE {table_name}
                            SET {', '.join(update_fields)}, synced_at = :synced_at, sync_status = :sync_status
                            WHERE id = :id AND clinic_id = :clinic_id
                        """)
                        local_db.execute(update_query, update_values)
                        stats["pulled"] += 1
                    else:
                        stats["conflicts"] += 1
                        # Local wins - will be pushed to cloud
                else:
                    # New record from cloud - insert
                    insert_fields = list(cloud_record.keys())
                    insert_placeholders = [f":{key}" for key in insert_fields]
                    
                    # Add sync metadata
                    cloud_record['synced_at'] = datetime.utcnow()
                    cloud_record['sync_status'] = 'synced'
                    
                    insert_query = text(f"""
                        INSERT INTO {table_name} ({', '.join(insert_fields)})
                        VALUES ({', '.join(insert_placeholders)})
                        ON CONFLICT (id) DO UPDATE SET
                            {', '.join([f"{key} = EXCLUDED.{key}" for key in insert_fields if key != 'id'])}
                    """)
                    local_db.execute(insert_query, cloud_record)
                    stats["pulled"] += 1
                
            except Exception as e:
                stats["errors"].append(f"Error applying cloud record {record_id}: {str(e)}")
        
        # Push local changes to cloud (upsert)
        for local_record in local_changes:
            record_id = local_record.get('id')
            if not record_id:
                continue
            
            try:
                # Remove sync metadata before pushing
                push_record = {k: v for k, v in local_record.items() if k not in ['synced_at', 'sync_status']}
                
                # Insert or update in cloud
                insert_fields = list(push_record.keys())
                insert_placeholders = [f":{key}" for key in insert_fields]
                
                insert_query = text(f"""
                    INSERT INTO {table_name} ({', '.join(insert_fields)})
                    VALUES ({', '.join(insert_placeholders)})
                    ON CONFLICT (id) DO UPDATE SET
                        {', '.join([f"{key} = EXCLUDED.{key}" for key in insert_fields if key != 'id'])}
                """)
                cloud_db.execute(insert_query, push_record)
                
                # Mark as synced in local
                update_query = text(f"""
                    UPDATE {table_name}
                    SET synced_at = :synced_at, sync_status = :sync_status
                    WHERE id = :id AND clinic_id = :clinic_id
                """)
                local_db.execute(update_query, {
                    "synced_at": datetime.utcnow(),
                    "sync_status": "synced",
                    "id": record_id,
                    "clinic_id": clinic_id
                })
                
                stats["pushed"] += 1
                
            except Exception as e:
                stats["errors"].append(f"Error pushing local record {record_id}: {str(e)}")
        
        local_db.commit()
        cloud_db.commit()
        
    except Exception as e:
        local_db.rollback()
        cloud_db.rollback()
        stats["errors"].append(f"Sync error: {str(e)}")
    finally:
        local_db.close()
        cloud_db.close()
    
    return stats

def sync_all_tables(user_id: int, clinic_id: int) -> Dict[str, Any]:
    """Sync all tables"""
    results = {
        "user_id": user_id,
        "clinic_id": clinic_id,
        "timestamp": datetime.utcnow().isoformat(),
        "tables": {},
        "total_pulled": 0,
        "total_pushed": 0,
        "total_conflicts": 0,
        "errors": []
    }
    
    for table in SYNC_TABLES:
        try:
            print(f"Syncing {table}...")
            stats = sync_table(table, user_id, clinic_id)
            results["tables"][table] = stats
            results["total_pulled"] += stats["pulled"]
            results["total_pushed"] += stats["pushed"]
            results["total_conflicts"] += stats["conflicts"]
            results["errors"].extend(stats["errors"])
        except Exception as e:
            error_msg = f"Error syncing {table}: {str(e)}"
            results["errors"].append(error_msg)
            results["tables"][table] = {"error": error_msg}
    
    return results

