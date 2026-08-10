from fastapi import APIRouter, Depends, HTTPException, status, Query
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

# ─── KPI cards and their detail drawer ───────────────────────────────────────
# Same envelope as the Payments and Lab KPI endpoints so the shared drawer
# component renders this section too.
#
# Deliberately no "stock value" metric. price_per_unit defaults to 0 and almost
# nothing sets it, so a value card would confidently report zero for a stocked
# clinic. The setup-completeness block below reports that gap instead, and the
# frontend only shows a value card once there is something to value.

from datetime import datetime, timedelta, date as _date
from sqlalchemy import func, or_
from models import MedicationStock, InventoryTransaction


def _inv_filtered(db: Session, clinic_id: int, *, category: Optional[str] = None,
                  search: Optional[str] = None):
    q = db.query(InventoryItem).filter(InventoryItem.clinic_id == clinic_id)
    if category:
        q = q.filter(InventoryItem.category == category)
    if search and len(search.strip()) >= 2:
        q = q.filter(InventoryItem.name.ilike(f"%{search.strip()}%"))
    return q


def _med_filtered(db: Session, clinic_id: int, *, search: Optional[str] = None):
    q = db.query(MedicationStock).filter(MedicationStock.clinic_id == clinic_id)
    if search and len(search.strip()) >= 2:
        q = q.filter(MedicationStock.name.ilike(f"%{search.strip()}%"))
    return q


def _is_low(item):
    return (item.min_stock_level or 0) > 0 and (item.quantity or 0) <= item.min_stock_level


@router.get("/summary")
async def inventory_summary(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Everything the Inventory KPI cards need, in one call."""
    cid = current_user.clinic_id
    today = _date.today()
    soon = today + timedelta(days=30)

    items = _inv_filtered(db, cid, category=category, search=search).all()
    meds = _med_filtered(db, cid, search=search).all()
    everything = items + meds

    by_category = {}
    for it in items:
        key = (it.category or 'Uncategorised')
        by_category[key] = by_category.get(key, 0) + 1
    if meds:
        by_category['Medications'] = len(meds)

    low = [i for i in everything if _is_low(i)]
    expired = [i for i in everything if i.expiry_date and i.expiry_date < today]
    expiring = [i for i in everything if i.expiry_date and today <= i.expiry_date <= soon]

    # Setup completeness — the reason several obvious metrics are missing.
    unpriced = [i for i in everything if not (i.price_per_unit or 0) > 0]
    undated = [i for i in items if i.expiry_date is None]  # consumables only
    priced_value = sum(
        float(i.quantity or 0) * float(i.price_per_unit or 0)
        for i in everything if (i.price_per_unit or 0) > 0
    )

    since = datetime.utcnow() - timedelta(days=30)
    moves = db.query(InventoryTransaction).filter(
        InventoryTransaction.clinic_id == cid,
        InventoryTransaction.created_at >= since,
    ).all()
    out_moves = [m for m in moves if (m.direction or 'out') == 'out']
    billed_out = [m for m in out_moves if m.invoice_line_item_id is not None]

    return {
        "items": {
            "total": len(everything),
            "consumables": len(items),
            "medications": len(meds),
            "categories": [
                {"category": k, "count": v}
                for k, v in sorted(by_category.items(), key=lambda x: -x[1])
            ],
        },
        "attention": {
            "low": len(low),
            "expired": len(expired),
            "expiring": len(expiring),
            # Distinguishes "nothing expires soon" from "nothing has a date" —
            # the alert reads 0 either way, and only one of those is good news.
            "expiry_tracked": sum(1 for i in everything if i.expiry_date is not None),
        },
        "movement": {
            "total": len(moves),
            "out": len(out_moves),
            "in": len(moves) - len(out_moves),
            "billed": len(billed_out),
            "window_days": 30,
        },
        "setup": {
            "unpriced": len(unpriced),
            "undated": len(undated),
            "priced_value": round(priced_value, 2),
            # The frontend shows a value card only when this is true.
            "value_usable": len(unpriced) == 0 and len(everything) > 0,
        },
    }


@router.get("/kpi-detail")
async def inventory_kpi_detail(
    metric: str = Query("items", description="items | attention | movement"),
    period: str = Query("all"),
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cid = current_user.clinic_id
    today = _date.today()
    now = datetime.utcnow()
    soon = today + timedelta(days=30)

    items = _inv_filtered(db, cid, category=category, search=search).all()
    meds = _med_filtered(db, cid, search=search).all()
    everything = items + meds

    def unit_of(i):
        return i.unit or 'units'

    # ── Items per category ──
    if metric == "items":
        by_category = {}
        for it in items:
            by_category[it.category or 'Uncategorised'] = by_category.get(it.category or 'Uncategorised', 0) + 1
        if meds:
            by_category['Medications'] = len(meds)
        series = [{"label": k, "total": v} for k, v in sorted(by_category.items(), key=lambda x: -x[1])]

        unpriced = sum(1 for i in everything if not (i.price_per_unit or 0) > 0)
        if not everything:
            narrative = "Nothing is being tracked yet. Add your first stock item to get started."
        else:
            narrative = (
                f"{len(everything)} items across {len(by_category)} "
                f"{'category' if len(by_category) == 1 else 'categories'} — "
                f"{len(items)} {'consumable' if len(items) == 1 else 'consumables'} and "
                f"{len(meds)} {'medication' if len(meds) == 1 else 'medications'}. "
            )
            narrative += (
                f"{unpriced} of them have no unit price, so stock value cannot be calculated yet."
                if unpriced else "All of them are priced, so stock value is available."
            )

        rows = [{
            "id": f"i{i.id}",
            "title": i.name,
            "subtitle": f"{getattr(i, 'category', None) or 'Medication'}"
                        + (f" · {i.batch_number}" if getattr(i, 'batch_number', None) else ""),
            "display": f"{float(i.quantity or 0):g} {unit_of(i)}",
        } for i in sorted(everything, key=lambda x: -(x.quantity or 0))]

        return {"metric": metric, "period": period, "series": series, "keys": ["total"],
                "narrative": narrative, "rows": rows, "is_money": False,
                "x_label": "items per category", "row_label": "Everything tracked"}

    # ── What needs doing ──
    if metric == "attention":
        low = [i for i in everything if _is_low(i)]
        expired = [i for i in everything if i.expiry_date and i.expiry_date < today]
        expiring = [i for i in everything if i.expiry_date and today <= i.expiry_date <= soon]
        tracked = sum(1 for i in everything if i.expiry_date is not None)

        series = [
            {"label": "Low stock", "total": len(low)},
            {"label": "Expiring", "total": len(expiring)},
            {"label": "Expired", "total": len(expired)},
        ]

        parts = []
        if low:
            parts.append(f"{len(low)} {'item is' if len(low) == 1 else 'items are'} at or below the reorder level")
        if expired:
            parts.append(f"{len(expired)} already expired")
        if expiring:
            parts.append(f"{len(expiring)} expiring within 30 days")

        if not parts:
            narrative = "Nothing needs attention right now."
        else:
            narrative = parts[0].capitalize() + (", " + ", ".join(parts[1:]) if len(parts) > 1 else "") + ". "

        if tracked == 0 and everything:
            narrative += ("No item has an expiry date recorded, so the expiry warnings above "
                          "will stay at zero whatever the real state of the shelf. Worth fixing "
                          "before you rely on them.")
        elif tracked < len(everything):
            narrative += (f"Only {tracked} of {len(everything)} items have an expiry date, so the "
                          "expiry figures cover part of your stock.")

        rows = []
        for i in low + expired + expiring:
            flags = []
            if _is_low(i):
                flags.append("low stock")
            if i.expiry_date and i.expiry_date < today:
                flags.append("expired")
            elif i.expiry_date and i.expiry_date <= soon:
                flags.append(f"expires {i.expiry_date.isoformat()}")
            rows.append({
                "id": f"a{i.id}",
                "title": i.name,
                "subtitle": " · ".join(flags) or "flagged",
                "display": f"{float(i.quantity or 0):g} {unit_of(i)}",
                "stalled": bool(i.expiry_date and i.expiry_date < today),
            })

        return {"metric": metric, "period": period, "series": series, "keys": ["total"],
                "narrative": narrative, "rows": rows, "is_money": False,
                "row_label": "Items flagged"}

    # ── Stock movement ──
    if metric == "movement":
        days = 7 if period == "7days" else 30 if period == "month" else 1 if period == "today" else 90
        start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
        step = max(1, days // 10)
        buckets = []
        cur = start
        while cur < now:
            nxt = cur + timedelta(days=step)
            buckets.append((cur.strftime("%d %b"), cur, nxt))
            cur = nxt

        moves = db.query(InventoryTransaction).filter(
            InventoryTransaction.clinic_id == cid,
            InventoryTransaction.created_at >= start,
        ).all()

        ins = [0.0] * len(buckets)
        outs = [0.0] * len(buckets)
        for m in moves:
            for i, (_, s, e) in enumerate(buckets):
                if m.created_at and s <= m.created_at < e:
                    if (m.direction or 'out') == 'out':
                        outs[i] += float(m.quantity or 0)
                    else:
                        ins[i] += float(m.quantity or 0)
                    break

        series = [{"label": buckets[i][0], "cash": round(outs[i], 2),
                   "digital": round(ins[i], 2), "total": round(outs[i] + ins[i], 2)}
                  for i in range(len(buckets))]

        out_moves = [m for m in moves if (m.direction or 'out') == 'out']
        billed = [m for m in out_moves if m.invoice_line_item_id is not None]

        if not moves:
            narrative = "No stock has moved in this window."
        else:
            narrative = (f"{len(out_moves)} {'movement' if len(out_moves) == 1 else 'movements'} out "
                         f"and {len(moves) - len(out_moves)} in. ")
            if out_moves:
                narrative += (
                    f"{len(billed)} of the {len(out_moves)} usages "
                    f"{'was' if len(billed) == 1 else 'were'} charged to a patient"
                    + ("." if len(billed) == len(out_moves)
                       else f", so {len(out_moves) - len(billed)} went out without being billed.")
                )

        rows = [{
            "id": f"m{m.id}",
            "title": m.item_name,
            "subtitle": f"{(m.action or m.direction or 'moved')}"
                        + (" · billed" if m.invoice_line_item_id else "")
                        + (f" · {m.created_at:%d %b}" if m.created_at else ""),
            "display": f"{'-' if (m.direction or 'out') == 'out' else '+'}{float(m.quantity or 0):g} {m.unit or ''}".strip(),
            "stalled": (m.direction or 'out') == 'out' and m.invoice_line_item_id is None,
        } for m in sorted(moves, key=lambda x: x.created_at or now, reverse=True)]

        return {"metric": metric, "period": period, "series": series,
                "keys": ["cash", "digital"], "narrative": narrative, "rows": rows,
                "is_money": False, "row_label": "Recent movements"}

    raise HTTPException(status_code=400, detail=f"Unknown metric '{metric}'")


# NOTE: these are declared *above* `GET /{item_id}` on purpose. FastAPI
# matches routes in declaration order, so a later `/summary` would be
# swallowed by the int path param and 422 before it ever ran.
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
