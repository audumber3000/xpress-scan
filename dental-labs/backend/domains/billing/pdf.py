"""HTML → PDF rendering for billing statements.

Ported from MolarPlus `domains/infrastructure/services/pdf_service.py` (the WeasyPrint
path), trimmed to a single in-memory call: render an HTML string to PDF bytes.
"""


def render_pdf(html: str) -> bytes:
    """Render a complete HTML document to PDF bytes using WeasyPrint."""
    from weasyprint import HTML
    from weasyprint.text.fonts import FontConfiguration

    font_config = FontConfiguration()
    return HTML(string=html).write_pdf(
        font_config=font_config,
        presentational_hints=True,
    )
