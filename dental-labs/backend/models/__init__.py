"""
Models package — re-exports all models for convenient imports.

Usage:
    from models import Lab, LabUser, Client, Product, Case, ...
"""
from models.base import Base
from models.lab import Lab, LabUser
from models.client import Client
from models.catalog import Product
from models.case import Case, CaseItem, CaseStatusHistory, CaseAttachment
from models.billing import Invoice, InvoiceLineItem, Payment
from models.notification import NotificationLog

__all__ = [
    "Base",
    "Lab", "LabUser",
    "Client",
    "Product",
    "Case", "CaseItem", "CaseStatusHistory", "CaseAttachment",
    "Invoice", "InvoiceLineItem", "Payment",
    "NotificationLog",
]
