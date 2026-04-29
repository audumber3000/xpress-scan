"""Nexus PDFService — vestigial post Phase 8.

The consent rendering logic moved to the main backend's
`backend/domains/consent/consent_templates/` package and is invoked via
`POST /api/v1/internal/consent/render`. ConsentService now calls that endpoint
directly. The only thing left here is the temp-file cleanup helper used after
the PDF bytes have been written and uploaded.
"""
import os


class PDFService:
    @staticmethod
    def cleanup(file_path):
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
