#!/usr/bin/env python
"""Render every registered template variant to its thumbnail.

The picker's thumbnails used to be drawn by hand as SVGs, which meant they were
a second, independent description of each layout — and the moment a template
changed, the picture stopped being true. A clinic choosing a layout from a stale
thumbnail picks the wrong one and only finds out on a patient's invoice.

These are rendered by the same engine production uses, from the same sample
data as the live preview, so a thumbnail cannot disagree with the document it
promises. Re-run after adding or changing a variant:

    cd backend && venv/bin/python scripts/build_template_thumbnails.py

Writes 420x593 PNGs (A4 aspect) into static/template-thumbnails/, which is what
`list_variants()` advertises and the web picker loads.
"""
import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "template-thumbnails")
WIDTH, HEIGHT = 420, 593

# The colour the thumbnails are rendered in. Deliberately the app's own indigo
# rather than each layout's default: the picker is comparing *layouts*, and six
# different accent colours would have people choosing by colour instead.
PREVIEW_COLOR = "#2a276e"
PREVIEW_FOOTER = "This is a computer generated document."


def _png(html: str, path: str) -> int:
    from weasyprint import HTML
    import fitz

    buf = io.BytesIO()
    HTML(string=html).write_pdf(target=buf, presentational_hints=True)
    doc = fitz.open(stream=buf.getvalue(), filetype="pdf")
    page = doc[0]
    # Scale from the page's own size so a template with unusual margins is not
    # silently squashed to fit.
    zoom = WIDTH / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    from PIL import Image
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img = img.crop((0, 0, WIDTH, min(HEIGHT, img.height)))
    if img.height < HEIGHT:                       # pad rather than stretch
        canvas = Image.new("RGB", (WIDTH, HEIGHT), "white")
        canvas.paste(img, (0, 0))
        img = canvas
    img.save(path, optimize=True)
    return os.path.getsize(path)


def main() -> int:
    from domains.infrastructure.services.preview_samples import (
        config_from_payload, preview_clinic, sample_consent, sample_invoice,
        sample_patient, sample_prescription_request,
    )
    from domains.finance.invoice_templates import INVOICE_VARIANTS
    from domains.medical.prescription_templates import PRESCRIPTION_VARIANTS
    from domains.consent.consent_templates import CONSENT_VARIANTS
    from domains.medical.services.prescription_service import PrescriptionService

    os.makedirs(OUT_DIR, exist_ok=True)
    clinic = preview_clinic(None, doctor_name="Dr R. Sharma")
    written = 0

    def cfg(template_id):
        return config_from_payload({
            "template_id": template_id,
            "primary_color": PREVIEW_COLOR,
            "footer_text": PREVIEW_FOOTER,
        })

    for vid, v in INVOICE_VARIANTS.items():
        path = os.path.join(OUT_DIR, f"invoice-{vid}.png")
        size = _png(v["render"](sample_invoice(), clinic, cfg(vid)), path)
        print(f"  invoice-{vid:<12} {size:>7,}B")
        written += 1

    svc = PrescriptionService(None)
    for vid in PRESCRIPTION_VARIANTS:
        path = os.path.join(OUT_DIR, f"prescription-{vid}.png")
        html = svc.render_prescription_html(
            sample_patient(), clinic, sample_prescription_request(), config_override=cfg(vid)
        )
        size = _png(html, path)
        print(f"  prescription-{vid:<7} {size:>7,}B")
        written += 1

    sample = sample_consent()
    for vid, v in CONSENT_VARIANTS.items():
        path = os.path.join(OUT_DIR, f"consent-{vid}.png")
        html = v["render"](
            clinic=clinic, patient_name=sample["patient_name"],
            patient_id=sample["patient_id"], template_name=sample["template_name"],
            content=sample["content"], signature_base64=sample.get("signature_base64", ""),
            config=cfg(vid),
        )
        size = _png(html, path)
        print(f"  consent-{vid:<12} {size:>7,}B")
        written += 1

    print(f"\n{written} thumbnails written to static/template-thumbnails/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
