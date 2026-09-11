"""
Product catalog model — the services/products a lab offers.

Products have a default unit price and turnaround time. Labs can customise
per-client pricing in a later phase.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from models.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False, default="other")
    # Categories: crown, bridge, denture, implant, aligner, veneer,
    #             inlay_onlay, night_guard, repair, other

    material = Column(String(100), nullable=True)                  # e.g. zirconia, PFM, e.max
    unit_price = Column(Float, default=0.0, nullable=False)
    default_turnaround_days = Column(Integer, default=5, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    lab = relationship("Lab", back_populates="products")
