import datetime

def generate_invoice_html(invoice, clinic, config=None) -> str:
    """Generate HTML content for invoice PDF matching the configured layout"""
    # Use config if provided, otherwise fallback to clinic attributes
    template_type = config.template_id if config and config.template_id else getattr(clinic, 'invoice_template', 'modern_orange')
    primary_color = config.primary_color if config and config.primary_color else None
    footer_text = config.footer_text if config and config.footer_text else ""

    if template_type not in ['modern_orange', 'classic_blue', 'minimalist_mono', 'elegant_green']:
        template_type = 'modern_orange'

    payment_status_label = "UPI – Unverified" if invoice.status == 'paid_unverified' and invoice.payment_mode == 'UPI' else invoice.status.replace('_', ' ').title()
    
    # Process Logo
    logo_html = ""
    # Use config logo if provided, otherwise clinic logo
    logo_url = config.logo_url if config and config.logo_url else getattr(clinic, 'logo_url', None)
    
    if logo_url:
        logo_html = f'<img src="{logo_url}" alt="Logo" class="logo-img">'
    else:
        logo_html = f'<div class="logo-placeholder">{clinic.name[:2].upper() if clinic else "IN"}</div>'
        
    # Clinic details
    c_name = clinic.name if clinic else 'Dental Clinic'
    c_phone = clinic.phone if clinic and clinic.phone else ''
    c_email = clinic.email if clinic and clinic.email else ''
    c_address = clinic.address if clinic and clinic.address else ''
    gst_number = getattr(clinic, 'gst_number', '') if clinic else ''
    
    # Patient details
    p_name = invoice.patient.name if invoice.patient else ''
    p_phone = invoice.patient.phone if invoice.patient else ''
    p_village = getattr(invoice.patient, 'village', '') if invoice.patient else ''
    
    # Context
    context = {
        'invoice': invoice,
        'payment_status_label': payment_status_label,
        'logo_html': logo_html,
        'c_name': c_name,
        'c_phone': c_phone,
        'c_email': c_email,
        'c_address': c_address,
        'gst_number': gst_number,
        'p_name': p_name,
        'p_phone': p_phone,
        'p_village': p_village,
        'primary_color': primary_color,
        'footer_text': footer_text,
    }

    # Tax split for visual purposes
    invoice_tax = getattr(invoice, 'tax', 0)
    if invoice_tax > 0:
        half_tax = invoice_tax / 2
        context['tax_html'] = f"""
        <div class="summary-row">
            <span>CGST:</span>
            <span>₹{half_tax:.2f}</span>
        </div>
        <div class="summary-row">
            <span>SGST:</span>
            <span>₹{half_tax:.2f}</span>
        </div>
        """
    else:
        context['tax_html'] = """
        <div class="summary-row">
            <span>GST (0%):</span>
            <span>₹0.00</span>
        </div>
        """

    discount_amount = getattr(invoice, 'discount_amount', 0)
    if discount_amount > 0:
        context['discount_html'] = f"""
        <div class="summary-row">
            <span>Discount:</span>
            <span style="color: #d32f2f;">- ₹{discount_amount:.2f}</span>
        </div>
        """
    else:
        context['discount_html'] = ""
        
    line_items_html = ""
    for item in invoice.line_items:
        line_items_html += f"""
        <tr>
            <td class="col-desc">{item.description}</td>
            <td class="col-rate">{(item.unit_price):.2f}</td>
            <td class="col-qty">{item.quantity}</td>
            <td class="col-amt">{(item.amount):.2f}</td>
        </tr>
        """
    context['line_items_html'] = line_items_html

    if template_type == 'modern_orange':
        return _render_modern_orange(context)
    elif template_type == 'classic_blue':
        return _render_classic_blue(context)
    elif template_type == 'minimalist_mono':
        return _render_minimalist_mono(context)
    elif template_type == 'elegant_green':
        return _render_elegant_green(context)
    
    return _render_modern_orange(context)


def _render_modern_orange(c):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            body {{ font-family: 'Roboto', Arial, sans-serif; margin: 40px; color: #000; font-size: 13px; }}
            .header-table {{ width: 100%; margin-bottom: 40px; }}
            .logo-placeholder {{ width: 120px; height: 120px; background-color: #f5f5f5; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: #888; border-radius: 4px; }}
            .logo-img {{ max-width: 140px; max-height: 120px; object-fit: contain; }}
            .title-right {{ text-align: right; vertical-align: top; }}
            .invoice-title {{ color: {c['primary_color'] or '#FF9800'}; font-size: 48px; font-weight: 700; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 1px; }}
            .meta-table {{ float: right; text-align: right; color: #555; }}
            .meta-table td {{ padding: 3px 0 3px 20px; }}
            .meta-label {{ color: #777; }}
            .meta-val {{ font-weight: 500; color: #000; }}
            .addresses {{ width: 100%; margin-bottom: 40px; }}
            .addresses td {{ vertical-align: top; width: 50%; }}
            .address-block h4 {{ font-size: 13px; color: #000; margin: 0 0 5px 0; }}
            .address-block .name {{ font-size: 16px; font-weight: 700; margin-bottom: 15px; text-transform: uppercase; }}
            .contact-line {{ margin-bottom: 3px; }}
            .contact-lbl {{ display: inline-block; width: 70px; color: #000; }}
            .items-table {{ width: 100%; border-collapse: collapse; margin-bottom: 30px; }}
            .items-table th {{ background-color: {c['primary_color'] or '#FF9800'}; color: #FFF; font-weight: 700; padding: 10px; font-size: 12px; text-transform: uppercase; }}
            .items-table td {{ padding: 12px 10px; border-bottom: 1px solid #eee; }}
            .items-table tr:nth-child(even) {{ background-color: #fdfdfd; }}
            .col-desc {{ text-align: left; }}
            .col-rate {{ text-align: center; width: 140px; }}
            .col-qty {{ text-align: center; width: 80px; }}
            .col-amt {{ text-align: right; width: 140px; }}
            .bottom-grid {{ display: table; width: 100%; margin-bottom: 50px; }}
            .payment-info {{ display: table-cell; width: 50%; vertical-align: top; padding-right: 20px; }}
            .summary-box {{ display: table-cell; width: 50%; vertical-align: top; }}
            .summary-row {{ display: flex; justify-content: space-between; padding: 6px 0; }}
            .summary-row span:last-child {{ font-weight: 500; min-width: 100px; text-align: right; }}
            .total-row {{ display: flex; justify-content: space-between; padding: 12px 0; margin-top: 10px; font-weight: 700; font-size: 15px; background-color: {c['primary_color'] + '15' if c['primary_color'] else '#fff3e0'}; border-radius: 4px; }}
            .signatures {{ width: 100%; margin-top: 80px; }}
            .signatures td {{ width: 50%; text-align: center; vertical-align: bottom; }}
            .sig-line {{ border-top: 1px solid #000; width: 200px; margin: 0 auto 5px auto; }}
            .sig-name {{ font-weight: 700; text-transform: uppercase; }}
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="width: 50%;">{c['logo_html']}</td>
                <td class="title-right">
                    <h1 class="invoice-title">Invoice</h1>
                    <table class="meta-table">
                        <tr><td class="meta-label">Invoice no.:</td><td class="meta-val">{c['invoice'].invoice_number}</td></tr>
                        <tr><td class="meta-label">Invoice date:</td><td class="meta-val">{c['invoice'].created_at.strftime('%m.%d.%Y') if c['invoice'].created_at else ''}</td></tr>
                        <tr><td class="meta-label">Status:</td><td class="meta-val">{c['payment_status_label']}</td></tr>
                    </table>
                </td>
            </tr>
        </table>
        <table class="addresses">
            <tr>
                <td class="address-block">
                    <h4>From</h4>
                    <div class="name">{c['c_name']}</div>
                    {f'<div class="contact-line">GST: {c["gst_number"]}</div>' if c['gst_number'] else ''}
                    {f'<div class="contact-line"><span class="contact-lbl">[E-MAIL]</span> {c["c_email"]}</div>' if c['c_email'] else ''}
                    {f'<div class="contact-line"><span class="contact-lbl">[PHONE]</span> {c["c_phone"]}</div>' if c['c_phone'] else ''}
                    {f'<div class="contact-line" style="margin-top:10px;"><span class="contact-lbl">[ADDRESS]</span> <br/>{c["c_address"]}</div>' if c['c_address'] else ''}
                </td>
                <td class="address-block" style="text-align: right;">
                    <h4>To</h4>
                    <div class="name">{c['p_name']}</div>
                    {f'<div class="contact-line">{c["p_phone"]} <span class="contact-lbl"> :[PHONE]</span></div>' if c['p_phone'] else ''}
                    {f'<div class="contact-line" style="margin-top:10px;">{c["p_village"]} <br/><span class="contact-lbl">:[ADDRESS]</span></div>' if c['p_village'] else ''}
                </td>
            </tr>
        </table>
        <table class="items-table">
            <thead>
                <tr><th class="col-desc">DESCRIPTION</th><th class="col-rate">RATE, ₹</th><th class="col-qty">QTY</th><th class="col-amt">AMOUNT, ₹</th></tr>
            </thead>
            <tbody>{c['line_items_html']}</tbody>
        </table>
        <div class="bottom-grid">
            <div class="payment-info">
                <h4 style="margin: 0 0 10px 0; font-size: 13px;">Payment instruction</h4>
                {f'<div style="margin-bottom: 5px;">Method: <strong>{c["invoice"].payment_mode}</strong></div>' if c["invoice"].payment_mode else '<div style="color: #888;">No payment method recorded.</div>'}
                {f'<div>UTR: {c["invoice"].utr}</div>' if getattr(c["invoice"], 'utr', None) else ''}
                {f'<div style="margin-top: 30px;"><strong>Notes:</strong><br/>{c["invoice"].notes}</div>' if getattr(c["invoice"], 'notes', None) else ''}
            </div>
            <div class="summary-box">
                <div class="summary-row"><span>Subtotal:</span><span>₹{float(c["invoice"].subtotal):.2f}</span></div>
                {c['discount_html']}
                {c['tax_html']}
                <div class="total-row"><span>Balance Due:</span><span>₹{float(c["invoice"].total):.2f}</span></div>
            </div>
        </div>
        <table class="signatures">
            <tr>
                <td><div class="sig-line"></div><div>Client signature</div><div class="sig-name">[{c['p_name']}]</div></td>
                <td><div class="sig-line"></div><div>Business signature</div><div class="sig-name">[{c['c_name']}]</div></td>
            </tr>
        </table>
        <div style="margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #888; font-size: 11px;">
            {c['footer_text']}
        </div>
    </body>
    </html>
    """

def _render_classic_blue(c):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');
            body {{ font-family: 'Open Sans', Arial, sans-serif; margin: 40px; color: #333; font-size: 13px; }}
            .header-table {{ width: 100%; border-bottom: 3px solid {c['primary_color'] or '#1e3a8a'}; padding-bottom: 20px; margin-bottom: 30px; }}
            .logo-placeholder {{ width: 100px; height: 100px; background-color: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #94a3b8; border-radius: 8px; }}
            .logo-img {{ max-width: 120px; max-height: 100px; object-fit: contain; }}
            .title-right {{ text-align: right; vertical-align: middle; }}
            .invoice-title {{ color: {c['primary_color'] or '#1e3a8a'}; font-size: 38px; font-weight: 700; margin: 0; letter-spacing: 2px; text-transform: uppercase; }}
            .invoice-subtitle {{ color: #64748b; font-size: 14px; margin-top: 5px; }}
            .addresses {{ width: 100%; margin-bottom: 40px; }}
            .addresses td {{ vertical-align: top; width: 50%; padding: 15px; }}
            .address-box-from {{ background-color: #f8fafc; border-left: 4px solid {c['primary_color'] or '#1e3a8a'}; border-radius: 4px; }}
            .address-box-to {{ background-color: #fff; border: 1px solid #e2e8f0; border-radius: 4px; }}
            .address-block h4 {{ font-size: 12px; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; }}
            .address-block .name {{ font-size: 16px; font-weight: 700; margin-bottom: 10px; color: #1e293b; }}
            .items-table {{ width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #e2e8f0; }}
            .items-table th {{ background-color: {c['primary_color'] or '#1e3a8a'}; color: #FFF; font-weight: 600; padding: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }}
            .items-table td {{ padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }}
            .items-table tr:nth-child(even) {{ background-color: #f8fafc; }}
            .col-desc {{ text-align: left; }}
            .col-rate {{ text-align: center; width: 120px; }}
            .col-qty {{ text-align: center; width: 80px; }}
            .col-amt {{ text-align: right; width: 120px; font-weight: 600; }}
            .bottom-grid {{ display: table; width: 100%; margin-bottom: 50px; }}
            .payment-info {{ display: table-cell; width: 50%; vertical-align: top; padding-right: 20px; }}
            .summary-box {{ display: table-cell; width: 50%; vertical-align: top; }}
            .summary-row {{ display: flex; justify-content: space-between; padding: 8px 15px; border-bottom: 1px solid #f1f5f9; }}
            .summary-row span:last-child {{ font-weight: 600; min-width: 100px; text-align: right; }}
            .total-row {{ display: flex; justify-content: space-between; padding: 15px; margin-top: 5px; font-weight: 700; font-size: 16px; background-color: {c['primary_color'] + '10' if c['primary_color'] else '#eff6ff'}; color: {c['primary_color'] or '#1e3a8a'}; border: 1px solid {c['primary_color'] + '30' if c['primary_color'] else '#bfdbfe'}; border-radius: 4px; }}
            .signatures {{ width: 100%; margin-top: 60px; }}
            .signatures td {{ width: 50%; text-align: center; vertical-align: bottom; }}
            .sig-line {{ border-top: 1px solid #94a3b8; width: 220px; margin: 0 auto 5px auto; }}
            .sig-name {{ font-weight: 600; color: #1e293b; }}
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="width: 50%;">{c['logo_html']}</td>
                <td class="title-right">
                    <h1 class="invoice-title">INVOICE</h1>
                    <div class="invoice-subtitle">NO. {c['invoice'].invoice_number} &nbsp;|&nbsp; DATE: {c['invoice'].created_at.strftime('%d %b %Y') if c['invoice'].created_at else ''}</div>
                    <div class="invoice-subtitle" style="color: #1e3a8a; font-weight: 600; margin-top: 8px;">STATUS: {c['payment_status_label']}</div>
                </td>
            </tr>
        </table>
        <table class="addresses">
            <tr>
                <td class="address-block address-box-from">
                    <h4>Billed From</h4>
                    <div class="name">{c['c_name']}</div>
                    {f'<div>GST: {c["gst_number"]}</div>' if c['gst_number'] else ''}
                    {f'<div>Email: {c["c_email"]}</div>' if c['c_email'] else ''}
                    {f'<div>Phone: {c["c_phone"]}</div>' if c['c_phone'] else ''}
                    {f'<div style="margin-top:8px; line-height: 1.5;">{c["c_address"]}</div>' if c['c_address'] else ''}
                </td>
                <td class="address-block address-box-to">
                    <h4>Billed To</h4>
                    <div class="name">{c['p_name']}</div>
                    {f'<div>Phone: {c["p_phone"]}</div>' if c['p_phone'] else ''}
                    {f'<div style="margin-top:8px; line-height: 1.5;">{c["p_village"]}</div>' if c['p_village'] else ''}
                </td>
            </tr>
        </table>
        <table class="items-table">
            <thead>
                <tr><th class="col-desc">DESCRIPTION</th><th class="col-rate">RATE (₹)</th><th class="col-qty">QTY</th><th class="col-amt">AMOUNT (₹)</th></tr>
            </thead>
            <tbody>{c['line_items_html']}</tbody>
        </table>
        <div class="bottom-grid">
            <div class="payment-info">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1e3a8a; text-transform: uppercase;">Payment Details</h4>
                {f'<div style="margin-bottom: 5px;">Method: <strong>{c["invoice"].payment_mode}</strong></div>' if c["invoice"].payment_mode else '<div style="color: #94a3b8;">Pending Payment</div>'}
                {f'<div>UTR: {c["invoice"].utr}</div>' if getattr(c["invoice"], 'utr', None) else ''}
                {f'<div style="margin-top: 25px; padding: 15px; background: #f8fafc; border-radius: 4px; border-left: 3px solid #64748b;"><strong>Notes:</strong><br/>{c["invoice"].notes}</div>' if getattr(c["invoice"], 'notes', None) else ''}
            </div>
            <div class="summary-box">
                <div class="summary-row"><span>Subtotal:</span><span>₹{float(c["invoice"].subtotal):.2f}</span></div>
                {c['discount_html']}
                {c['tax_html']}
                <div class="total-row"><span>Total Due:</span><span>₹{float(c["invoice"].total):.2f}</span></div>
            </div>
        </div>
        <table class="signatures">
            <tr>
                <td><div class="sig-line"></div><div style="color: #64748b; margin-bottom: 5px;">Client Signature</div><div class="sig-name">{c['p_name']}</div></td>
                <td><div class="sig-line"></div><div style="color: #64748b; margin-bottom: 5px;">Authorized Signatory</div><div class="sig-name">{c['c_name']}</div></td>
            </tr>
        </table>
        <div style="margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #64748b; font-size: 11px;">
            {c['footer_text']}
        </div>
    </body>
    </html>
    """

def _render_minimalist_mono(c):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');
            body {{ font-family: 'Space Grotesk', sans-serif; margin: 50px; color: #000; font-size: 13px; line-height: 1.6; }}
            .header-table {{ width: 100%; border-bottom: 1px solid #000; padding-bottom: 30px; margin-bottom: 40px; }}
            .logo-placeholder {{ width: 80px; height: 80px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #000; letter-spacing: 2px; }}
            .logo-img {{ max-width: 120px; max-height: 80px; filter: grayscale(100%); }}
            .invoice-title {{ font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 4px; text-transform: uppercase; text-align: right; }}
            .meta-grid {{ display: flex; justify-content: flex-end; gap: 40px; margin-top: 15px; font-size: 11px; text-transform: uppercase; }}
            .addresses {{ width: 100%; margin-bottom: 50px; }}
            .addresses td {{ vertical-align: top; width: 50%; }}
            .address-block h4 {{ font-size: 11px; color: #666; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #eee; padding-bottom: 5px; display: inline-block; }}
            .name {{ font-size: 15px; font-weight: 700; margin-bottom: 5px; letter-spacing: 1px; text-transform: uppercase; }}
            .items-table {{ width: 100%; border-collapse: collapse; margin-bottom: 40px; }}
            .items-table th {{ border-top: 1px solid #000; border-bottom: 1px solid #000; font-weight: 700; padding: 15px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #000; text-align: left; }}
            .items-table td {{ padding: 15px 10px; border-bottom: 1px dashed #ddd; }}
            .amt-col {{ text-align: right !important; font-weight: 500; }}
            .summary-box {{ float: right; width: 40%; margin-bottom: 50px; }}
            .summary-row {{ display: flex; justify-content: space-between; padding: 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }}
            .total-row {{ display: flex; justify-content: space-between; padding: 15px 0; margin-top: 10px; font-weight: 700; font-size: 16px; border-top: 2px solid {c['primary_color'] or '#000'}; border-bottom: 2px solid {c['primary_color'] or '#000'}; text-transform: uppercase; letter-spacing: 2px; color: {c['primary_color'] or '#000'}; }}
            .payment-info {{ clear: both; width: 50%; padding: 20px; border: 1px solid #eee; font-size: 12px; }}
            .footer {{ margin-top: 100px; border-top: 1px solid #000; padding-top: 20px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; }}
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="width: 50%;">{c['logo_html']}</td>
                <td style="vertical-align: bottom;">
                    <h1 class="invoice-title">INVOICE</h1>
                    <div class="meta-grid">
                        <div><div style="color:#666">INV NO</div><div style="font-weight:700">{c['invoice'].invoice_number}</div></div>
                        <div><div style="color:#666">DATE</div><div style="font-weight:700">{c['invoice'].created_at.strftime('%m.%d.%Y') if c['invoice'].created_at else ''}</div></div>
                        <div><div style="color:#666">STATUS</div><div style="font-weight:700">{c['payment_status_label']}</div></div>
                    </div>
                </td>
            </tr>
        </table>
        <table class="addresses">
            <tr>
                <td class="address-block" style="padding-right: 40px;">
                    <h4>Billed From</h4>
                    <div class="name">{c['c_name']}</div>
                    <div style="color: #444;">
                        {f'GST: {c["gst_number"]}<br/>' if c['gst_number'] else ''}
                        {c["c_address"]}<br/>
                        {c["c_email"]} | {c["c_phone"]}
                    </div>
                </td>
                <td class="address-block">
                    <h4>Billed To</h4>
                    <div class="name">{c['p_name']}</div>
                    <div style="color: #444;">
                        {c["p_village"]}<br/>
                        {c["p_phone"]}
                    </div>
                </td>
            </tr>
        </table>
        <table class="items-table">
            <thead>
                <tr><th style="width:50%">DESCRIPTION</th><th>RATE (₹)</th><th>QTY</th><th class="amt-col">AMOUNT (₹)</th></tr>
            </thead>
            <tbody>
                {c['line_items_html'].replace('class="col-', 'class="').replace('class="amt"', 'class="amt-col"')}
            </tbody>
        </table>
        <div class="summary-box">
            <div class="summary-row"><span>SUBTOTAL</span><span>₹{float(c["invoice"].subtotal):.2f}</span></div>
            {c['discount_html'].replace('color: #d32f2f;', 'color: #000; font-weight: 700;')}
            {c['tax_html']}
            <div class="total-row"><span>TOTAL</span><span>₹{float(c["invoice"].total):.2f}</span></div>
        </div>
        <div class="payment-info">
            <div style="font-weight:700; margin-bottom: 10px; letter-spacing: 1px;">PAYMENT DETAILS</div>
            {f'<div>METHOD: {c["invoice"].payment_mode}</div>' if c["invoice"].payment_mode else '<div>PENDING</div>'}
            {f'<div>UTR: {c["invoice"].utr}</div>' if getattr(c["invoice"], 'utr', None) else ''}
            {f'<div style="margin-top: 15px; color: #666; font-style: italic;">> {c["invoice"].notes}</div>' if getattr(c["invoice"], 'notes', None) else ''}
        </div>
        <div class="footer">
            {c['footer_text']}
        </div>
    </body>
    </html>
    """

def _render_elegant_green(c):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
            body {{ font-family: 'Outfit', sans-serif; margin: 0; padding: 40px; color: #2d3748; font-size: 14px; background-color: #fafdfb; }}
            .container {{ background: #fff; border-radius: 20px; box-shadow: 0 10px 30px rgba(15, 118, 110, 0.05); padding: 40px; border: 1px solid #f0fdf4; }}
            .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; }}
            .header-table {{ width: 100%; }}
            .logo-placeholder {{ width: 90px; height: 90px; background: linear-gradient(135deg, #10b981 0%, #0f766e 100%); border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; }}
            .logo-img {{ max-width: 120px; max-height: 90px; border-radius: 16px; }}
            .invoice-label {{ background-color: #ecfdf5; color: #059669; padding: 8px 16px; border-radius: 100px; font-weight: 600; font-size: 12px; letter-spacing: 1px; display: inline-block; margin-bottom: 15px; }}
            .invoice-title {{ font-size: 32px; font-weight: 700; color: #0f766e; margin: 0; }}
            .addresses {{ width: 100%; margin-bottom: 40px; background-color: #f8faf9; border-radius: 16px; padding: 25px; }}
            .addresses td {{ vertical-align: top; width: 50%; padding: 0 15px; }}
            .address-label {{ font-size: 12px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }}
            .name {{ font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 8px; }}
            .contact-text {{ color: #6b7280; line-height: 1.6; font-weight: 300; }}
            .items-table {{ width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; }}
            .items-table th {{ background-color: #0f766e; color: #fff; font-weight: 400; padding: 15px; font-size: 13px; letter-spacing: 0.5px; text-align: left; }}
            .items-table th:first-child {{ border-top-left-radius: 12px; border-bottom-left-radius: 12px; }}
            .items-table th:last-child {{ border-top-right-radius: 12px; border-bottom-right-radius: 12px; text-align: right; }}
            .items-table td {{ padding: 15px; border-bottom: 1px solid #f3f4f6; color: #4b5563; }}
            .items-table td:last-child {{ text-align: right; font-weight: 600; color: #111827; }}
            .row-summary {{ display: flex; justify-content: space-between; padding: 8px 0; color: #6b7280; }}
            .row-summary span:last-child {{ color: #111827; font-weight: 600; }}
            .total-box {{ background: linear-gradient(135deg, {c['primary_color'] or '#10b981'} 0%, {c['primary_color'] or '#0f766e'} 100%); border-radius: 16px; padding: 25px; color: #fff; margin-top: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.2); }}
            .total-label {{ font-size: 14px; opacity: 0.9; }}
            .total-amount {{ font-size: 28px; font-weight: 700; }}
            .meta-pills {{ display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }}
            .pill {{ background-color: #f3f4f6; padding: 6px 12px; border-radius: 8px; font-size: 12px; color: #4b5563; font-weight: 600; }}
        </style>
    </head>
    <body>
        <div class="container">
            <table class="header-table">
                <tr>
                    <td style="width: 50%; vertical-align: top;">
                        {c['logo_html']}
                    </td>
                    <td style="text-align: right; vertical-align: top;">
                        <div class="invoice-label">INVOICE #{c['invoice'].invoice_number}</div>
                        <div style="font-size: 15px; color: #6b7280; margin-top: 10px;">Date: {c['invoice'].created_at.strftime('%d %B %Y') if c['invoice'].created_at else ''}</div>
                        <div style="font-size: 15px; color: #6b7280; font-weight: 600; margin-top: 5px;">Status: <span style="color: #059669;">{c['payment_status_label']}</span></div>
                    </td>
                </tr>
            </table>

            <table class="addresses" style="margin-top: 30px;">
                <tr>
                    <td style="border-right: 1px solid #e5e7eb;">
                        <div class="address-label">Billed From</div>
                        <div class="name">{c['c_name']}</div>
                        <div class="contact-text">
                            {f'GST: {c["gst_number"]}<br/>' if c['gst_number'] else ''}
                            {c["c_address"]}<br/>
                            {c["c_email"]} | {c["c_phone"]}
                        </div>
                    </td>
                    <td>
                        <div class="address-label">Billed To</div>
                        <div class="name">{c['p_name']}</div>
                        <div class="contact-text">
                            {c["p_village"]}<br/>
                            {c["p_phone"]}
                        </div>
                    </td>
                </tr>
            </table>

            <table class="items-table">
                <thead>
                    <tr><th>Item Description</th><th style="text-align:center">Rate (₹)</th><th style="text-align:center">Qty</th><th>Total (₹)</th></tr>
                </thead>
                <tbody>
                    {c['line_items_html'].replace('class="col-desc"', '').replace('class="col-rate"', 'style="text-align:center;"').replace('class="col-qty"', 'style="text-align:center;"').replace('class="col-amt"', '')}
                </tbody>
            </table>

            <table style="width: 100%;">
                <tr>
                    <td style="width: 45%; vertical-align: bottom; padding-right: 40px;">
                        <div class="address-label">Payment Information</div>
                        <div class="meta-pills">
                            {f'<div class="pill">Method: {c["invoice"].payment_mode}</div>' if c["invoice"].payment_mode else ''}
                            {f'<div class="pill">UTR: {c["invoice"].utr}</div>' if getattr(c["invoice"], 'utr', None) else ''}
                        </div>
                        {f'<div style="margin-top: 20px; font-size: 13px; color: #9ca3af; background: #f9fafb; padding: 15px; border-radius: 12px;">{c["invoice"].notes}</div>' if getattr(c["invoice"], 'notes', None) else ''}
                        
                        <div style="margin-top: 60px; border-top: 1px solid #e5e7eb; padding-top: 10px; width: 200px; color: #9ca3af; font-size: 12px; text-align: center;">Authorized Signature</div>
                    </td>
                    <td style="width: 55%; vertical-align: bottom;">
                        <div class="row-summary"><span>Subtotal calculation</span><span>₹{float(c["invoice"].subtotal):.2f}</span></div>
                        {c['discount_html']}
                        {c['tax_html']}
                        
                        <div class="total-box">
                            <div>
                                <div class="total-label">Total Amount Due</div>
                                <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">Includes all applied taxes & discounts</div>
                            </div>
                            <div class="total-amount">₹{float(c["invoice"].total):.2f}</div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
        <div style="margin-top: 40px; text-align: center; color: #9ca3af; font-size: 11px;">
            {c['footer_text']}
        </div>
    </body>
    </html>
    """
