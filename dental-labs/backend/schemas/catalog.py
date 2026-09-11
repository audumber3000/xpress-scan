"""
Pydantic schemas for product catalog.
"""
from pydantic import BaseModel, Field


PRODUCT_CATEGORIES = [
    "crown", "bridge", "denture", "implant", "aligner",
    "veneer", "inlay_onlay", "night_guard", "repair", "other",
]


class ProductCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = "other"
    material: str | None = None
    unit_price: float = Field(default=0.0, ge=0)
    default_turnaround_days: int = Field(default=5, ge=1)


class ProductUpdateRequest(BaseModel):
    name: str | None = None
    category: str | None = None
    material: str | None = None
    unit_price: float | None = Field(default=None, ge=0)
    default_turnaround_days: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    category: str
    material: str | None = None
    unit_price: float
    default_turnaround_days: int
    is_active: bool

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    products: list[ProductResponse]
    total: int
