"""One-shot script: render each registered template variant via WeasyPrint,
convert the first page to a PNG thumbnail, save to static/template-thumbnails/.

Run after adding a new variant or changing CSS:

    cd backend && python scripts/generate_template_thumbnails.py

Output files:
    static/template-thumbnails/invoice-classic.png
    static/template-thumbnails/invoice-modern.png
    static/template-thumbnails/prescription-classic.png
    static/template-thumbnails/prescription-compact.png

Implementation notes:
- WeasyPrint's `write_pdf` is the supported path; `write_png` was deprecated
  in 53+. We render to PDF then rasterise the first page via pypdfium2 (no
  Poppler / system deps required, pure Python wheel).
- Renders at 80 DPI — readable but small (~50 KB per thumbnail).
- The picker UI in the registry currently points at .svg paths. After running
  this once, update `invoice_templates/__init__.py` and
  `prescription_templates/__init__.py` to use `.png` if you prefer the real
  rendered look. The SVG approximations are kept as a fallback.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path
from types import SimpleNamespace

# Allow running from backend/ root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from domains.infrastructure.services.preview_samples import (
    sample_clinic, sample_invoice, sample_patient, sample_prescription_request,
)

OUT_DIR = Path(__file__).resolve().parent.parent / "static" / "template-thumbnails"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DPI = 80   # ~660x933 px for A4 at 80 dpi
THUMB_W = 420  # final downsized width for fast load


def _render_pdf_bytes(html: str) -> bytes:
    from weasyprint import HTML
    return HTML(string=html).write_pdf()


def _pdf_first_page_to_png(pdf_bytes: bytes, dpi: int = DPI, max_width: int = THUMB_W) -> bytes:
    """Rasterise page 1 of a PDF to PNG. Uses pypdfium2 if available, else
    falls back to pdf2image. Resizes to <= max_width to keep file small."""
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(pdf_bytes)
        page = pdf[0]
        scale = dpi / 72
        bitmap = page.render(scale=scale)
        pil_image = bitmap.to_pil()
    except ImportError:
        try:
            from pdf2image import convert_from_bytes
            pages = convert_from_bytes(pdf_bytes, dpi=dpi, first_page=1, last_page=1)
            pil_image = pages[0]
        except ImportError:
            raise SystemExit(
                "Need either pypdfium2 (preferred) or pdf2image installed.\n"
                "Try: pip install pypdfium2"
            )

    # Downscale for faster picker load
    if pil_image.width > max_width:
        ratio = max_width / pil_image.width
        new_size = (max_width, int(pil_image.height * ratio))
        from PIL import Image as PILImage
        pil_image = pil_image.resize(new_size, PILImage.LANCZOS)

    buf = io.BytesIO()
    pil_image.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_variant(variant_id: str, render_fn, *args) -> bytes:
    """Render a variant to HTML → PDF → PNG, returning the PNG bytes."""
    html = render_fn(*args)
    pdf = _render_pdf_bytes(html)
    return _pdf_first_page_to_png(pdf)


def main():
    from domains.finance.invoice_templates import INVOICE_VARIANTS
    from domains.medical.prescription_templates import PRESCRIPTION_VARIANTS
    from domains.medical.services.prescription_service import PrescriptionService

    clinic = sample_clinic()
    invoice = sample_invoice()
    patient = sample_patient()
    rx_data = sample_prescription_request()

    # ── Invoice variants ────────────────────────────────────────────────────
    for vid, meta in INVOICE_VARIANTS.items():
        cfg = SimpleNamespace(
            template_id=vid,
            primary_color=None,
            footer_text="Computer-generated invoice. No signature required.",
            logo_url=None,
        )
        png = render_variant(vid, meta["render"], invoice, clinic, cfg)
        out = OUT_DIR / f"invoice-{vid}.png"
        out.write_bytes(png)
        print(f"  ✓ {out.name}  ({len(png) // 1024} KB)")

    # ── Prescription variants ───────────────────────────────────────────────
    class _StubDB:
        def query(self, *a, **kw): return self
        def filter(self, *a, **kw): return self
        def first(self): return None

    svc = PrescriptionService(_StubDB())

    # ── Consent variants (Phase 8) ──────────────────────────────────────────
    from domains.consent.consent_templates import CONSENT_VARIANTS
    from domains.infrastructure.services.preview_samples import sample_consent
    rx_data_consent = sample_consent()
    for vid, meta in CONSENT_VARIANTS.items():
        cfg = SimpleNamespace(
            template_id=vid,
            primary_color=None,
            footer_text="Computer-generated consent.",
            logo_url=None,
        )
        html = meta["render"](
            clinic=clinic,
            patient_name=rx_data_consent["patient_name"],
            patient_id=rx_data_consent["patient_id"],
            template_name=rx_data_consent["template_name"],
            content=rx_data_consent["content"],
            signature_base64=rx_data_consent["signature_base64"],
            config=cfg,
        )
        pdf = _render_pdf_bytes(html)
        png = _pdf_first_page_to_png(pdf)
        out = OUT_DIR / f"consent-{vid}.png"
        out.write_bytes(png)
        print(f"  ✓ {out.name}  ({len(png) // 1024} KB)")

    for vid, meta in PRESCRIPTION_VARIANTS.items():
        cfg = SimpleNamespace(
            template_id=vid,
            primary_color=None,
            footer_text="Computer-generated prescription.",
            logo_url=None,
        )
        html = svc.render_prescription_html(patient, clinic, rx_data, config_override=cfg)
        pdf = _render_pdf_bytes(html)
        png = _pdf_first_page_to_png(pdf)
        out = OUT_DIR / f"prescription-{vid}.png"
        out.write_bytes(png)
        print(f"  ✓ {out.name}  ({len(png) // 1024} KB)")

    print(f"\nDone. {OUT_DIR}")


if __name__ == "__main__":
    main()
