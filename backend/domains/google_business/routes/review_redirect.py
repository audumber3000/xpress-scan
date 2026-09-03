"""The link a patient actually taps when we ask for a Google review.

WhatsApp opens links in its own embedded browser. That window has none of the
patient's Google session, so `search.google.com/local/writereview` greets them
with a sign-in wall instead of the star picker, and the review does not happen.
The same is true of Instagram, Facebook and most other apps with an in-app
browser.

A sender cannot tell WhatsApp to use the real browser. There is no URL parameter
for it: the app decides. So the review message points here instead, and this
page gets them out.

What is actually possible differs by platform, and it is worth being exact:

  Android   navigating to an `intent:` URL hands the request to the system,
            which opens the default browser. Still works from most WebViews,
            though Meta narrows it over time, so there is a timed fallback.

  iOS       nothing reliable. `x-safari-https:` and the other escape schemes are
            closed or closing, and a page that keeps trying them just sits
            there. So iOS is told, in one sentence, to use the menu it already
            has. Guiding the escape is what stays working.

  Anything else — a real browser, an email client, a desktop — never sees this
  page. It redirects before paint.
"""
import os
from urllib.parse import quote

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter()


@router.get("/{clinic_id}", include_in_schema=False)
async def review_redirect(clinic_id: int, db: Session = Depends(get_db)):
    """Send the patient to this clinic's Google review form, in a real browser.

    Public by design: the person opening it is a patient with a phone, not a
    signed-in user. It reveals only a Google Place id, which is on the clinic's
    public Maps listing already.
    """
    from domains.notification.services import google_review_service as grs
    from models import Clinic

    target = grs.review_link(db, clinic_id)
    if not target:
        # The listing was disconnected between sending the message and the tap.
        # Send them to the clinic rather than showing a broken page.
        return RedirectResponse(url=os.getenv("FRONTEND_URL", "https://molarplus.com"))

    clinic_name = db.query(Clinic.name).filter(Clinic.id == clinic_id).scalar() or "our clinic"

    # `intent:` needs the scheme moved into the fragment, and a fallback so a
    # device with no browser registered still lands somewhere.
    bare = target.split("://", 1)[1]
    intent_url = (
        f"intent://{bare}#Intent;scheme=https;action=android.intent.action.VIEW;"
        f"S.browser_fallback_url={quote(target, safe='')};end"
    )

    return HTMLResponse(content=_PAGE.format(
        target=_js(target),
        intent=_js(intent_url),
        target_attr=target.replace('"', "&quot;"),
        clinic=clinic_name.replace("<", "&lt;").replace(">", "&gt;"),
    ))


def _js(value: str) -> str:
    """Escape a string for a single-quoted JavaScript literal."""
    return (
        value.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("<", "\\x3c")
        .replace("\n", "")
    )


# Deliberately one self-contained document with no external requests. It sits
# between a patient and a review they were willing to leave, so every extra
# round trip is people lost.
_PAGE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Leave a review</title>
<style>
  * {{ box-sizing:border-box; }}
  body {{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         margin:0; min-height:100vh; display:flex; align-items:center;
         justify-content:center; padding:24px; background:#f4f5f7; color:#111827; }}
  .card {{ background:#fff; border:1px solid #e5e7eb; border-radius:16px;
           padding:32px 26px; max-width:420px; width:100%; text-align:center; }}
  .stars {{ font-size:30px; letter-spacing:2px; margin-bottom:14px; }}
  h1 {{ font-size:20px; margin:0 0 10px; font-weight:700; }}
  p {{ color:#6b7280; font-size:15px; line-height:1.6; margin:0 0 8px; }}
  .step {{ margin:20px 0 4px; padding:14px 16px; background:#f9fafb;
           border:1px solid #e5e7eb; border-radius:10px; text-align:left;
           font-size:14px; line-height:1.6; color:#374151; }}
  .step b {{ color:#111827; }}
  .btn {{ display:block; margin-top:16px; padding:14px 18px; border-radius:10px;
          background:#2a276e; color:#fff; text-decoration:none; font-weight:600;
          font-size:15px; border:0; width:100%; cursor:pointer;
          font-family:inherit; }}
  .quiet {{ display:inline-block; margin-top:14px; color:#6b7280; font-size:13px; }}
  .hidden {{ display:none; }}
  .waiting {{ color:#6b7280; font-size:15px; }}
</style>
</head>
<body>
  <div class="card">
    <div class="stars">&#11088;&#11088;&#11088;&#11088;&#11088;</div>
    <h1>Review {clinic}</h1>

    <p id="wait" class="waiting">Opening Google&hellip;</p>

    <div id="guide" class="hidden">
      <p>Google needs you signed in to post a review, and this window inside
         the app is not.</p>
      <div class="step" id="how"></div>
      <button class="btn" id="copy" type="button">Copy the link</button>
      <a class="quiet" id="go" href="{target_attr}">Open here anyway</a>
    </div>

    <noscript>
      <p><a class="btn" href="{target_attr}">Open Google review</a></p>
    </noscript>
  </div>

<script>
(function () {{
  var TARGET = '{target}';
  var INTENT = '{intent}';
  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua);

  // An embedded WebView rather than a browser tab. Android WebViews carry the
  // "; wv)" token; iOS ones are the ones missing "Safari/", which every real
  // mobile Safari sends. The named apps cover the rest.
  var inApp = /; wv\\)/.test(ua)
    || /FBAN|FBAV|Instagram|Line\\/|MicroMessenger|WhatsApp/i.test(ua)
    || (isIOS && !/Safari\\//.test(ua));

  function guide(html) {{
    document.getElementById('wait').className = 'hidden';
    document.getElementById('how').innerHTML = html;
    document.getElementById('guide').className = '';
    document.getElementById('copy').addEventListener('click', function (e) {{
      var btn = e.currentTarget;
      var done = function () {{ btn.textContent = 'Link copied'; }};
      if (navigator.clipboard) {{
        navigator.clipboard.writeText(TARGET).then(done, done);
      }} else {{
        var t = document.createElement('textarea');
        t.value = TARGET; document.body.appendChild(t); t.select();
        try {{ document.execCommand('copy'); }} catch (err) {{}}
        document.body.removeChild(t); done();
      }}
    }});
  }}

  if (!inApp) {{
    // A real browser. They are already where they need to be.
    location.replace(TARGET);
    return;
  }}

  if (isAndroid) {{
    // Hand off to the system, which opens the default browser. If we are still
    // here a moment later it did not take, so ask instead of leaving them on a
    // page that says "Opening" forever.
    var left = false;
    document.addEventListener('visibilitychange', function () {{
      if (document.hidden) left = true;
    }});
    try {{ location.href = INTENT; }} catch (e) {{}}
    setTimeout(function () {{
      if (!left && !document.hidden) {{
        guide('Tap the <b>&#8942;</b> menu at the top right, then '
            + '<b>Open in browser</b>. You are already signed in there.');
      }}
    }}, 1400);
    return;
  }}

  // iOS, inside an app. No escape worth attempting, so say the one thing that
  // works rather than spinning.
  guide('Tap the <b>&#8943;</b> or share button in the corner, then '
      + '<b>Open in Safari</b>. You are already signed in there.');
}})();


</script>
</body>
</html>
"""
