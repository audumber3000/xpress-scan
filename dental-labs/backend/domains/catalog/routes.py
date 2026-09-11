"""
Catalog routes — product/service CRUD.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from core.auth import get_current_user
from models import LabUser, Product
from schemas.catalog import ProductCreateRequest, ProductUpdateRequest, ProductResponse, ProductListResponse

router = APIRouter()


@router.get("")
def list_products(
    category: str = Query(default=None),
    is_active: bool = Query(default=True),
    search: str = Query(default=None),
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    query = db.query(Product).filter(Product.lab_id == user.lab_id)

    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    if category:
        query = query.filter(Product.category == category)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    products = query.order_by(Product.category, Product.name).all()
    return {
        "products": [ProductResponse.model_validate(p).model_dump() for p in products],
        "total": len(products),
    }


@router.post("")
def create_product(
    body: ProductCreateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    product = Product(lab_id=user.lab_id, **body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"product": ProductResponse.model_validate(product).model_dump()}


@router.put("/{product_id}")
def update_product(
    product_id: int,
    body: ProductUpdateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.lab_id == user.lab_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(product, key):
            setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return {"product": ProductResponse.model_validate(product).model_dump()}


@router.delete("/{product_id}")
def deactivate_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.lab_id == user.lab_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = False
    db.commit()
    return {"message": "Product deactivated"}
