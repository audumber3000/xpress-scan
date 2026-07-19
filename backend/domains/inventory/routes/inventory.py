from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import InventoryItem, User, Vendor
from core.dtos import InventoryItemCreateDTO, InventoryItemUpdateDTO, InventoryItemResponseDTO
from core.auth_utils import get_current_user

router = APIRouter()


def ensure_inventory_permission(current_user: User, action: str):
    if current_user.role == "clinic_owner":
        return

    permissions = current_user.permissions or {}
    inventory_permissions = permissions.get("inventory", {})
    if inventory_permissions.get(action) is not True:
        raise HTTPException(status_code=403, detail=f"Insufficient permissions. Required: inventory.{action}")

@router.get("", response_model=List[InventoryItemResponseDTO])
async def list_inventory(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    clinic_id: Optional[int] = None
):
    ensure_inventory_permission(current_user, "read")
    query = db.query(InventoryItem)
    target_clinic_id = clinic_id or current_user.clinic_id
    query = query.filter(InventoryItem.clinic_id == target_clinic_id)
    
    items = query.all()
    # Enrich with vendor name
    result = []
    for item in items:
        dto = InventoryItemResponseDTO.from_orm(item)
        if item.vendor_id:
            vendor = db.query(Vendor).filter(Vendor.id == item.vendor_id).first()
            if vendor:
                dto.vendor_name = vendor.name
        result.append(dto)
    return result

@router.post("", response_model=InventoryItemResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    item_data: InventoryItemCreateDTO,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    ensure_inventory_permission(current_user, "write")
    clinic_id = getattr(item_data, "clinic_id", None) or getattr(current_user, "clinic_id", 1)
    item = InventoryItem(**item_data.dict())
    item.clinic_id = clinic_id
    db.add(item)
    db.flush()  # get item.id before writing the ledger row

    # Record the opening stock as an 'in' movement (stock already set on the item).
    from domains.inventory.services.ledger import record_movement
    record_movement(
        db, clinic_id=clinic_id, item=item, direction="in", action="added",
        quantity=item.quantity, note="Opening stock", adjust_stock=False,
    )

    db.commit()
    db.refresh(item)
    return item

@router.get("/{item_id}", response_model=InventoryItemResponseDTO)
async def get_inventory_item(item_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_inventory_permission(current_user, "read")
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItemResponseDTO.from_orm(item)

@router.put("/{item_id}", response_model=InventoryItemResponseDTO)
async def update_inventory_item(
    item_id: int,
    item_data: InventoryItemUpdateDTO,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    ensure_inventory_permission(current_user, "edit")
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    updates = item_data.dict(exclude_unset=True)
    old_qty = item.quantity or 0.0
    for key, value in updates.items():
        setattr(item, key, value)

    # If the quantity was edited directly, log the delta to the ledger so the
    # change is visible there (stock is already set, so don't re-adjust).
    if "quantity" in updates and updates["quantity"] is not None:
        delta = (updates["quantity"] or 0.0) - old_qty
        if delta != 0:
            from domains.inventory.services.ledger import record_movement
            record_movement(
                db, clinic_id=item.clinic_id, item=item,
                direction="in" if delta > 0 else "out", quantity=abs(delta),
                action="restocked" if delta > 0 else "deducted",
                note="Stock adjustment", adjust_stock=False,
            )

    db.commit()
    db.refresh(item)

    # Push stock alert if quantity dropped below min level
    if item.min_stock_level and item.quantity <= item.min_stock_level:
        from core.push_notify import push_to_clinic
        push_to_clinic(
            db, item.clinic_id,
            "⚠️ Low Stock Alert",
            f"{item.name} — only {item.quantity} {item.unit or 'units'} left",
            {"type": "stock_alert", "item_id": str(item.id)},
        )

    return InventoryItemResponseDTO.from_orm(item)

@router.delete("/{item_id}")
async def delete_inventory_item(item_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_inventory_permission(current_user, "delete")
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Log the removal (item_name snapshot survives the delete).
    from models import InventoryTransaction
    db.add(InventoryTransaction(
        clinic_id=item.clinic_id, direction="out", action="removed",
        item_name=item.name, unit=item.unit, quantity=item.quantity or 0.0,
        note="Item deleted",
    ))

    # Detach ledger rows before deleting: they keep their item_name/unit
    # snapshot, so the history survives while the FK no longer blocks the delete.
    db.query(InventoryTransaction).filter(
        InventoryTransaction.inventory_item_id == item_id
    ).update({"inventory_item_id": None}, synchronize_session=False)

    db.delete(item)
    db.commit()
    return {"message": "Inventory item deleted successfully"}
