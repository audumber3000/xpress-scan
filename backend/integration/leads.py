"""The `growth_leads` table, defined here rather than in `models.py`.

It does not belong to MolarPlus. The support console created it lazily on first
use (`create_all` on its own two tables) and was the only thing that ever wrote
to it, so when that tool is retired nothing writes leads any more — the CRM's
Opportunity object takes over.

The table itself stays, and `GET /integration/v1/leads` reads it, because the
pipeline history in there is real and has to reach the CRM once. Keeping the
model inside the integration package rather than in the product's `models.py`
says exactly that: this is a table we read for a migration, not part of the
product's own domain.
"""
import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text

from models import Base


class GrowthLead(Base):
    __tablename__ = "growth_leads"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=True)
    lead_name = Column(String)
    contact_person = Column(String)
    phone = Column(String)
    email = Column(String)
    source = Column(String)
    stage = Column(String)
    owner = Column(String)
    priority = Column(String)
    expected_mrr = Column(Float)
    trial_start = Column(DateTime)
    trial_end = Column(DateTime)
    next_follow_up_at = Column(DateTime)
    last_contact_at = Column(DateTime)
    lost_reason = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)
