"""
Shared helper for writing to the inventory ledger (InventoryTransaction).

`adjust_stock=True` mutates the item's quantity (manual movements, visit usage).
`adjust_stock=False` records a change already applied to the item — opening
stock on create, or a direct quantity edit on the item form — so the ledger
reflects it without double-counting.
"""
from models import InventoryTransaction


def record_movement(db, *, clinic_id, item, direction, quantity,
                    note=None, patient_id=None, case_paper_id=None, adjust_stock=True):
    if quantity is None or quantity <= 0:
        return None

    txn = InventoryTransaction(
        clinic_id=clinic_id,
        patient_id=patient_id,
        case_paper_id=case_paper_id,
        inventory_item_id=item.id,
        direction=direction,
        item_name=item.name,
        unit=item.unit,
        quantity=quantity,
        note=note,
    )
    if adjust_stock:
        if direction == "in":
            item.quantity = (item.quantity or 0.0) + quantity
        else:
            item.quantity = max(0.0, (item.quantity or 0.0) - quantity)
    db.add(txn)
    return txn
