"""
Renders a clinic's public website as real HTML.

Server-rendered on purpose. The app frontend is a client-rendered SPA, so the
first HTML Google receives there is an empty <div id="root">. A clinic website
exists to be found by someone searching "dentist near me", and a page whose
content only appears after JavaScript runs is exactly the page that quietly
fails to index. Everything below is in the markup before any script runs.

Content comes entirely from setup data the clinic already maintains: name,
tagline, hours, treatments and prices, synced Google reviews, staff dentists.
The site therefore cannot go stale, because it is the same rows the app runs on.

Every section hides itself when its data is empty, so a half-configured clinic
never publishes an empty box.
"""
import html
import re
from datetime import datetime
from typing import List, Optional

DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DAY_SHORT = {"monday": "Mon", "tuesday": "Tue", "wednesday": "Wed", "thursday": "Thu",
             "friday": "Fri", "saturday": "Sat", "sunday": "Sun"}


def slugify(name: str) -> str:
    """A URL handle from a clinic name. Not unique on its own; the caller checks."""
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", name or "").strip().lower()
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s[:60] or "clinic"


def e(v) -> str:
    """Escape anything clinic-entered. All of this is free text they control."""
    return html.escape(str(v or ""), quote=True)


def _fmt_time(t: str) -> str:
    """'14:30' -> '2:30 pm'. Patients do not read 24-hour clocks."""
    try:
        h, m = (t or "").split(":")[:2]
        h, m = int(h), int(m)
        ampm = "am" if h < 12 else "pm"
        h12 = h % 12 or 12
        return f"{h12}:{m:02d} {ampm}" if m else f"{h12} {ampm}"
    except Exception:
        return t or ""


def group_hours(timings: dict) -> List[dict]:
    """Collapse seven days into runs, so 'Mon to Sat 10am to 6pm' is one line."""
    if not isinstance(timings, dict):
        return []
    rows, run = [], []

    def flush():
        if not run:
            return
        first, last = run[0], run[-1]
        label = DAY_SHORT[first] if first == last else f"{DAY_SHORT[first]} to {DAY_SHORT[last]}"
        d = timings.get(first) or {}
        rows.append({
            "days": label,
            "closed": bool(d.get("closed")),
            "hours": "Closed" if d.get("closed")
                     else f"{_fmt_time(d.get('open'))} to {_fmt_time(d.get('close'))}",
        })

    prev_sig = None
    for day in DAY_ORDER:
        d = timings.get(day) or {}
        sig = (bool(d.get("closed")), d.get("open"), d.get("close"))
        if sig != prev_sig and run:
            flush(); run = []
        run.append(day); prev_sig = sig
    flush()
    return rows


def _stars(n: float) -> str:
    full = int(round(float(n or 0)))
    return "★" * max(0, min(5, full)) + "☆" * (5 - max(0, min(5, full)))


_DAY_SCHEMA = {"monday": "Monday", "tuesday": "Tuesday", "wednesday": "Wednesday",
               "thursday": "Thursday", "friday": "Friday", "saturday": "Saturday",
               "sunday": "Sunday"}


def _opening_spec(timings: dict) -> list:
    """Opening hours as schema.org expects them.

    Closed days are omitted rather than emitted with null times: a day absent
    from the spec already means closed, and inventing 00:00 to 00:00 reads as
    open all night.
    """
    out = []
    for key, label in _DAY_SCHEMA.items():
        t = (timings or {}).get(key) or {}
        if t.get("closed") or not t.get("open") or not t.get("close"):
            continue
        out.append({
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": f"https://schema.org/{label}",
            "opens": t["open"],
            "closes": t["close"],
        })
    return out


def _curate(items):
    seen, out = set(), []
    for t in items:
        raw = (t.get("name") or "").strip()
        # Normalised only for comparison, never for display: the clinic's
        # own spelling is what patients will hear on the phone.
        key = "".join(ch for ch in raw.lower() if ch.isalnum())
        if not key or key in seen:
            continue
        # A one-word name like "General" tells a patient nothing, so it is
        # kept only when nothing better is offered.
        seen.add(key)
        out.append(t)
    vague = {"general", "consultation", "other", "misc"}
    ranked = sorted(out, key=lambda t: ((t.get("name") or "").strip().lower() in vague,
                                        -(t.get("price") or 0)))
    return ranked[:12]


def _looks_like_reg(v) -> str:
    """Whether a registration number is worth publishing.

    The footer was printing "Reg. asdfasdfas" verbatim from a setup field
    somebody had typed into to get past validation. A registration number is a
    trust signal only when it reads like one, so obvious placeholder text is
    dropped rather than shown to patients.
    """
    v = (v or "").strip()
    if len(v) < 4 or len(v) > 40:
        return ""
    low = v.lower()
    if any(bad in low for bad in ("asdf", "qwer", "test", "abcd", "xxxx", "1234")):
        return ""
    # Needs at least one digit: real registration numbers carry one.
    return v if any(ch.isdigit() for ch in v) else ""


def _initials(name: str) -> str:
    parts = [p for p in re.split(r"\s+", (name or "").strip()) if p]
    return ("".join(p[0] for p in parts[:2]) or "?").upper()


def render_site(ctx: dict) -> str:
    """The whole page.

    `ctx` is assembled by the route so this stays a pure function: easy to
    preview from the editor and easy to test without a database.
    """
    c = ctx["clinic"]
    accent = c.get("primary_color") or "#2a276e"
    name = e(c.get("name"))
    tagline_raw = (c.get("tagline") or "").strip()
    tagline = e(tagline_raw) or "Gentle, unhurried dental care."
    phone = e(c.get("phone"))
    phone_digits = re.sub(r"\D", "", c.get("phone") or "")
    address = e(c.get("address"))
    logo = c.get("logo_url")
    about = e(c.get("website_about"))

    # What the hero actually says about the practice.
    #
    # The hero used to print `tagline` and nothing else. Tagline is capped at
    # 120 characters and most clinics leave it empty, so the biggest text on
    # the page was usually the built-in fallback line — while the paragraph the
    # clinic actually wrote sat unread near the bottom in the About band. The
    # reference site leads with a real sentence or two about the practice, and
    # so should this.
    #
    # Order of preference: the clinic's own words, then its tagline, then a
    # sentence built from what we know (name and locality), and only then the
    # generic line. A described clinic beats a slogan.
    _locality_hint = e(c.get("locality") or "")
    if about:
        # First two sentences only. The About band still shows the whole thing;
        # a hero that runs to six lines stops being a hero.
        _sentences = re.split(r'(?<=[.!?])\s+', about.strip())
        hero_desc = " ".join(_sentences[:2]).strip()
    elif tagline_raw:
        hero_desc = e(tagline_raw)
    elif _locality_hint:
        hero_desc = (f"{name} is a dental clinic in {_locality_hint}, "
                     "offering gentle, unhurried care for the whole family.")
    else:
        hero_desc = "Gentle, unhurried dental care for the whole family."

    treatments = _curate(ctx.get("treatments") or [])
    import json as _json

    site_url = (ctx.get("site_url") or "").rstrip("/")
    booking_url = ctx.get("booking_url") or ""
    reviews = ctx.get("reviews") or []
    dentists = ctx.get("dentists") or []
    photos = ctx.get("photos") or []
    rating = ctx.get("rating")
    review_count = ctx.get("review_count") or 0
    stats = ctx.get("stats") or {}
    hours = group_hours(c.get("timings") or {})
    cur = c.get("currency_symbol") or "₹"

    wa = f"https://wa.me/{phone_digits}" if phone_digits else ""
    maps = f"https://www.google.com/maps/search/?api=1&query={e(c.get('address') or c.get('name'))}"

    # ── Hero art. No external images: a hotlinked asset is one 403 away from a
    # broken hero, and the clinic's own photo is better than any stock shot. A
    # clinic with no photos gets a drawn dental scene rather than a grey box.
    hero_media = (
        f'<img src="{e(photos[0]["url"])}" alt="Inside {name}" class="hero-img">'
        if photos else
        f'''<div class="hero-art" role="img" aria-label="Dental clinic illustration">
          <svg viewBox="0 0 240 200" fill="none">
            <circle cx="120" cy="96" r="78" fill="{accent}" opacity=".08"/>
            <circle cx="120" cy="96" r="56" fill="{accent}" opacity=".10"/>
            <path d="M120 46c-15 0-22 7-33 7-14 0-24 11-24 29 0 26 12 45 19 56 5 8 9 14 15 14 8 0 9-9 23-9s15 9 23 9c6 0 10-6 15-14 7-11 19-30 19-56 0-18-10-29-24-29-11 0-18-7-33-7z"
                  fill="#fff" stroke="{accent}" stroke-width="3" stroke-linejoin="round"/>
            <path d="M120 62c-8 0-12 4-12 10s4 8 4 16-3 10-3 16" stroke="{accent}"
                  stroke-width="2.5" stroke-linecap="round" opacity=".45"/>
          </svg>
        </div>'''
    )

    # ── Sections, each omitted when it has nothing to say ──
    treatments_html = ""
    if treatments:
        cards = "".join(
            f'''<li class="tcard">
                  <span class="tname">{e(t["name"])}</span>
                  {f'<span class="tprice">from {cur}{int(t["price"]):,}</span>' if t.get("price") else ''}
                </li>'''
            for t in treatments[:18]
        )
        treatments_html = f'''
        <section id="services" class="sec dark">
          <div class="wrap">
            <p class="eyebrow">What we do</p>
            <h2>Products &amp; Services</h2>
            <p class="sub">Straightforward pricing, told to you before we start.</p>
            <ul class="tgrid">{cards}</ul>
          </div>
        </section>'''

    reviews_html = ""
    if reviews:
        cards = "".join(
            f'''<figure class="rcard">
                  <div class="rtop">
                    <span class="av">{e(_initials(r.get("author_name")))}</span>
                    <div>
                      <b>{e(r.get("author_name") or "Patient")}</b>
                      <span class="stars">{_stars(r.get("rating"))}</span>
                    </div>
                  </div>
                  <blockquote>{e((r.get("text") or "")[:220])}</blockquote>
                </figure>'''
            for r in reviews[:6]
        )
        summary = (
            f'<p class="sub"><b>{review_count:,}+</b> users rated us <b>{rating:.1f}</b> out of 5.</p>'
            if rating else '<p class="sub">What our patients say on Google</p>'
        )
        reviews_html = f'''
        <section id="reviews" class="sec dark">
          <div class="wrap">
            <p class="eyebrow">🌟 Trusted by our patients</p>
            <h2>Why patients love {name}</h2>
            {summary}
            <div class="rgrid">{cards}</div>
          </div>
        </section>'''

    dentists_html = ""
    if dentists:
        cards = "".join(
            f'''<li class="dcard">
                  <span class="dav">{e(_initials(d.get("name")))}</span>
                  <b>{e(d.get("name"))}</b>
                  <span>{e(d.get("qualification") or "Dental Surgeon")}</span>
                </li>'''
            for d in dentists[:6]
        )
        dentists_html = f'''
        <section id="team" class="sec">
          <div class="wrap">
            <p class="eyebrow">Your team</p>
            <h2>Who you will see</h2>
            <ul class="dgrid">{cards}</ul>
          </div>
        </section>'''

    # Photos past the hero were being uploaded and never shown anywhere. A
    # clinic that took the trouble to add six pictures of its surgery should
    # see them on its own website.
    #
    # There used to be a second builder above this one writing the same
    # variable. The later assignment won, but BOTH were interpolated into the
    # page, so every clinic site rendered its gallery twice with a repeated
    # id="gallery". One builder, interpolated once.
    gallery_html = ""
    if len(photos) > 1:
        tiles = "".join(
            f'<figure><img src="{e(ph["url"])}" alt="{e(ph.get("caption") or name)}" loading="lazy"></figure>'
            for ph in photos[1:9]
        )
        gallery_html = f'''
    <section class="sec alt" id="gallery">
      <div class="wrap">
        <p class="eyebrow">Have a look</p>
        <h2>Inside the practice</h2>
        <div class="gallery">{tiles}</div>
      </div>
    </section>'''

    # Stats stand alone as their own band rather than sitting inside the
    # closing CTA, which is where the reference puts them and which stops the
    # numbers competing with the button for attention.
    stats_html = ""
    if c.get("website_show_stats"):
        # Treatments and reviews are counted from what is already on the page,
        # so the band cannot claim more services than the site actually lists.
        tiles = []
        if treatments:
            tiles.append((f"{len(treatments)}+", "Services Offered"))
        if review_count:
            tiles.append((f"{review_count:,}", "Customer Reviews"))
        for label, value in (stats or {}).items():
            if value:
                tiles.append((str(value), label))
        if tiles:
            items = "".join(f'<li><b>{e(v)}</b><span>{e(k)}</span></li>' for v, k in tiles[:4])
            stats_html = f'''
    <section id="stats" class="sec stats">
      <div class="wrap">
        <h2>Proven Success in Numbers</h2>
        <ul class="statlist">{items}</ul>
      </div>
    </section>'''

    # A phone number and a WhatsApp button were the only ways to act. The app
    # already publishes a booking page, so the site can send people straight
    # to it rather than asking them to compose a message.
    book_btn = (f'<a class="btn primary" href="{e(booking_url)}">Book an appointment</a>'
                if booking_url else "")
    book_band = f'''
    <section class="sec book dark" id="contact">
      <div class="wrap">
        <h2>Get in Touch</h2>
        <p class="sub">Contact us today for more information about our services.</p>
        <div class="row">
          {book_btn}
          {f'<a class="btn btn-wa" href="{wa}">Message on WhatsApp</a>' if wa else ''}
          {f'<a class="btn btn-ghost" href="tel:{phone}">{phone}</a>' if phone else ''}
        </div>
      </div>
    </section>''' if (booking_url or wa or phone) else ""

    hours_html = "".join(
        f'<li{" class=\"closed\"" if h["closed"] else ""}><span>{e(h["days"])}</span><b>{e(h["hours"])}</b></li>'
        for h in hours
    )
    about_html = f'<p class="about">{about}</p>' if about else ""

    # ── SEO ──────────────────────────────────────────────────────────────
    #
    # This page is rendered on the server specifically so it can be indexed,
    # and it was shipping with none of what makes that work: no structured
    # data, no share image, no canonical. For a clinic whose patients arrive
    # from a Google search and share links over WhatsApp, the structured data
    # is what puts it in the local pack and the image is what stops every
    # share looking broken.
    locality = c.get("locality") or ""
    page_title = f"{name} · Dentist in {e(locality)}" if locality else f"{name} · Dental clinic"
    meta_desc = (tagline or f"{name} is a dental clinic in {e(locality)}." if locality
                 else tagline or f"{name}, a dental clinic.")
    meta_desc = (meta_desc + " " + address).strip()[:300]

    canonical_tag = f'<link rel="canonical" href="{e(site_url)}">' if site_url else ""

    # Prefer the stable redirect over the presigned URL: a signed link in an
    # og:image expires and the share breaks.
    share_img = ctx.get("og_image_url") or (photos[0]["url"] if photos else (c.get("logo_url") or ""))
    og_image_tag = (
        f'<meta property="og:image" content="{e(share_img)}">'
        f'<meta property="og:image:alt" content="{name}">'
    ) if share_img else ""
    twitter_card = "summary_large_image" if share_img else "summary"

    # schema.org Dentist. Only fields we actually hold are emitted: an invented
    # opening time or a fabricated rating is worse than an absent one, both for
    # patients and because search engines penalise markup that does not match
    # the page.
    _ld = {
        "@context": "https://schema.org",
        "@type": "Dentist",
        "name": c.get("name") or "",
        "description": (tagline or "")[:300] or None,
        "url": site_url or None,
        "image": share_img or None,
        "telephone": c.get("phone") or None,
        "priceRange": "$$",
    }
    if c.get("address"):
        _ld["address"] = {"@type": "PostalAddress", "streetAddress": c["address"],
                          "addressLocality": locality or None, "addressCountry": "IN"}
    if ctx.get("rating") and ctx.get("review_count"):
        _ld["aggregateRating"] = {"@type": "AggregateRating",
                                  "ratingValue": round(float(ctx["rating"]), 1),
                                  "reviewCount": int(ctx["review_count"])}
    _spec = _opening_spec(c.get("timings") or {})
    if _spec:
        _ld["openingHoursSpecification"] = _spec
    if booking_url:
        _ld["potentialAction"] = {"@type": "ReserveAction",
                                  "target": {"@type": "EntryPoint", "urlTemplate": booking_url}}
    _ld = {k: v for k, v in _ld.items() if v not in (None, "", [], {})}
    json_ld = f'<script type="application/ld+json">{_json.dumps(_ld, ensure_ascii=False)}</script>'

    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{page_title}</title>
<meta name="description" content="{meta_desc}">
<meta name="robots" content="index,follow">
{canonical_tag}
<meta property="og:title" content="{name}">
<meta property="og:description" content="{meta_desc}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_IN">
{og_image_tag}
<meta name="twitter:card" content="{twitter_card}">
<meta name="twitter:title" content="{name}">
<meta name="twitter:description" content="{meta_desc}">
{json_ld}
<style>
  :root{{ --accent:{accent}; --ink:#16162e; --muted:#6b6b85; --rule:#e8e8f0; --wash:#f7f7fb; }}
  *{{box-sizing:border-box}}
  body{{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);line-height:1.6;background:#fff;-webkit-font-smoothing:antialiased}}
  img{{max-width:100%;display:block}}
  a{{color:inherit}}
  .wrap{{max-width:64rem;margin:0 auto;padding:0 1.25rem}}
  .eyebrow{{font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 .4rem}}
  h1,h2{{letter-spacing:-.03em;margin:0 0 .5rem;text-wrap:balance}}
  h2{{font-size:1.65rem;font-weight:800}}
  .sub{{color:var(--muted);margin:0 0 1.5rem}}
  .sec{{padding:2.75rem 0}}
  .sec + .sec{{padding-top:2rem}}
  .sec.alt{{background:var(--wash)}}
  .gallery{{display:grid;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));gap:.6rem}}
  .gallery figure{{margin:0;border-radius:10px;overflow:hidden;aspect-ratio:4/3;background:var(--rule)}}
  .gallery img{{width:100%;height:100%;object-fit:cover}}
  .sec.book{{background:var(--accent);color:#fff;text-align:center}}
  .sec.book h2{{color:#fff}}
  .sec.book .sub{{color:rgba(255,255,255,.75)}}
  .sec.book .row{{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}}
  .statlist{{list-style:none;display:flex;gap:2.5rem;justify-content:center;flex-wrap:wrap;margin:0;padding:0}}
  /* Was `.statlist strong`, which matched nothing: the markup emits <b>, so
     every stat number rendered at body size and weight. */
  .statlist b{{display:block;font-size:2rem;font-weight:800;line-height:1.1}}
  .statlist span{{font-size:.8rem;color:var(--muted)}}
  .sec.book .btn.primary{{background:#fff;color:var(--accent);font-weight:800}}

  /* ── Dark bands ──────────────────────────────────────────────────────
     The reference alternates full-width dark sections against light ones,
     which is what gives the page its rhythm. Set as one block so any section
     can opt in with class="dark" rather than each growing its own overrides. */
  .sec.dark{{background:#101828;color:#e8eaf0}}
  .sec.dark h2{{color:#fff}}
  .sec.dark .sub{{color:rgba(255,255,255,.7)}}
  .sec.dark .eyebrow{{color:color-mix(in srgb,var(--accent) 55%,#fff)}}
  .sec.dark .tcard,.sec.dark .rcard{{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12);color:#e8eaf0}}
  .sec.dark .tcard .tname,.sec.dark .rcard b{{color:#fff}}
  .sec.dark blockquote{{color:rgba(255,255,255,.78)}}
  .sec.dark .av{{background:rgba(255,255,255,.12);color:#fff}}
  .sec.book.dark{{background:#101828}}
  .sec.book.dark .btn.primary{{background:var(--accent);color:#fff}}

  /* Stats sit on the light wash between two dark bands, so the numbers get
     the page's full contrast rather than competing with a coloured ground. */
  .sec.stats{{background:var(--wash);text-align:center}}
  .sec.stats h2{{margin-bottom:1.5rem}}

  /* Business info strip under the header: phone, hours, location, which the
     reference puts above the fold rather than only in the footer. */
  .infobar{{background:var(--wash);border-top:1px solid var(--rule);font-size:.8rem;color:var(--muted)}}
  .infobar .wrap{{display:flex;flex-wrap:wrap;gap:1.25rem;padding:.5rem 1rem;height:auto}}

  header{{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--rule)}}
  header .wrap{{display:flex;align-items:center;justify-content:space-between;gap:1rem;height:4rem}}
  .brand{{display:flex;align-items:center;gap:.6rem;font-weight:800;letter-spacing:-.02em}}
  .brand img{{height:2rem;width:auto;border-radius:6px}}
  .brand .mark{{width:2rem;height:2rem;border-radius:8px;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:.8rem}}
  .btn{{display:inline-flex;align-items:center;gap:.45rem;padding:.6rem 1.05rem;border-radius:9px;font-size:.875rem;font-weight:700;text-decoration:none;white-space:nowrap}}
  .btn-wa{{background:#25D366;color:#fff}}
  .btn-solid{{background:var(--accent);color:#fff}}
  .btn-ghost{{background:#fff;color:var(--ink);border:1px solid var(--rule)}}
  nav a{{margin-left:1.25rem;font-size:.875rem;font-weight:600;color:var(--muted);text-decoration:none}}
  nav{{display:none}}
  @media(min-width:820px){{nav{{display:block}}}}

  /* Full-height hero, as the reference does (min-h-dvh). `dvh` accounts for
     the mobile browser chrome that `vh` ignores, and the min-height is capped
     by content so a long clinic name still fits. */
  .hero{{padding:3rem 0 3.5rem;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 7%,#fff),#fff);min-height:calc(100dvh - 4rem);display:flex;align-items:center}}
  .hero .wrap{{display:grid;gap:2rem;align-items:center}}
  @media(min-width:820px){{.hero .wrap{{grid-template-columns:1.05fr .95fr}}}}
  .hero h1{{font-size:2.1rem;font-weight:850}}
  @media(min-width:820px){{.hero h1{{font-size:2.9rem}}}}
  .hero p.lead{{font-size:1.05rem;color:var(--muted);max-width:52ch;line-height:1.6}}
  .cta-row{{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.5rem}}
  .trust{{display:flex;gap:1.25rem;flex-wrap:wrap;margin-top:1.75rem;font-size:.8125rem;color:var(--muted)}}
  .trust b{{color:var(--ink)}}
  .hero-img{{width:100%;height:22rem;object-fit:cover;border-radius:16px}}
  .hero-art{{border-radius:16px;background:var(--wash);display:grid;place-items:center;padding:2rem}}
  .hero-art svg{{width:100%;max-width:17rem;height:auto}}

  .tgrid{{list-style:none;padding:0;margin:0;display:grid;gap:.6rem;grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))}}
  .tcard{{border:1px solid var(--rule);border-radius:11px;padding:.85rem .95rem;display:flex;justify-content:space-between;align-items:baseline;gap:.6rem;background:#fff}}
  .tname{{font-weight:650;font-size:.9rem}}
  .tprice{{color:var(--accent);font-weight:800;font-size:.8125rem;white-space:nowrap}}

  .rgrid{{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))}}
  .rcard{{margin:0;background:#fff;border:1px solid var(--rule);border-radius:12px;padding:1rem}}
  .rtop{{display:flex;gap:.6rem;align-items:center;margin-bottom:.5rem}}
  .av{{width:2.1rem;height:2.1rem;border-radius:50%;background:color-mix(in srgb,var(--accent) 12%,#fff);color:var(--accent);display:grid;place-items:center;font-weight:800;font-size:.75rem;flex:none}}
  .rtop b{{display:block;font-size:.875rem}}
  .stars{{color:#f5a623;font-size:.8125rem;letter-spacing:.08em}}
  blockquote{{margin:0;font-size:.875rem;color:var(--muted)}}

  .dgrid,.ggrid{{list-style:none;padding:0;margin:0;display:grid;gap:.75rem}}
  .dgrid{{grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))}}
  .dcard{{border:1px solid var(--rule);border-radius:12px;padding:1.1rem;text-align:center;background:#fff}}
  .dav{{width:3rem;height:3rem;border-radius:50%;background:color-mix(in srgb,var(--accent) 12%,#fff);color:var(--accent);display:grid;place-items:center;font-weight:800;margin:0 auto .6rem}}
  .dcard b{{display:block;font-size:.9rem}}
  .dcard span{{font-size:.75rem;color:var(--muted)}}
  .ggrid{{grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))}}
  .gtile{{margin:0;border-radius:11px;overflow:hidden;aspect-ratio:4/3;background:var(--wash)}}
  .gtile img{{width:100%;height:100%;object-fit:cover}}

  .stats ul{{list-style:none;padding:0;margin:0;display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));text-align:center}}
  .stats b{{display:block;font-size:1.9rem;font-weight:850;letter-spacing:-.03em;color:var(--accent)}}
  .stats span{{font-size:.8125rem;color:var(--muted)}}

  .visit .wrap{{display:grid;gap:2rem}}
  @media(min-width:820px){{.visit .wrap{{grid-template-columns:1fr 1fr}}}}
  .hours{{list-style:none;padding:0;margin:0}}
  .hours li{{display:flex;justify-content:space-between;gap:1rem;padding:.6rem 0;border-bottom:1px solid var(--rule);font-size:.9rem}}
  .hours li:last-child{{border-bottom:0}}
  .hours li.closed{{color:var(--muted)}}
  .about{{color:var(--muted);margin:0 0 1.25rem}}

  footer{{background:var(--ink);color:rgba(255,255,255,.72);padding:2.5rem 0;font-size:.8125rem}}
  footer b{{color:#fff}}
  footer .wrap{{display:grid;gap:1.25rem}}
  footer a{{color:rgba(255,255,255,.72);text-decoration:none}}
  footer a:hover{{color:#fff}}
  .fblurb{{color:rgba(255,255,255,.6);margin:.4rem 0 0;max-width:34rem}}
  @media(min-width:820px){{footer .wrap{{grid-template-columns:2fr 1fr 1fr}}}}
  .credit{{margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.12);font-size:.75rem;color:rgba(255,255,255,.5)}}
</style>
</head>
<body>

<header>
  <div class="wrap">
    <span class="brand">
      {f'<img src="{e(logo)}" alt="{name}">' if logo else f'<span class="mark">{e(_initials(c.get("name")))}</span>'}
      {name}
    </span>
    <nav>
      <a href="#top">Home</a>
      {'<a href="#services">Products &amp; Services</a>' if treatments else ''}
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
    {f'<a class="btn btn-wa" href="{wa}">Contact</a>' if wa else (f'<a class="btn btn-solid" href="tel:{phone}">Call</a>' if phone else '')}
  </div>
  {(
    '<div class="infobar"><div class="wrap">'
    + (f'<span>📞 {phone}</span>' if phone else '')
    + (f'<span>🕒 {e(hours[0]["days"])} · {e(hours[0]["hours"])}</span>' if hours else '')
    + (f'<span>📍 {address}</span>' if address else '')
    + '</div></div>'
  ) if (phone or hours or address) else ''}
</header>

<section class="hero" id="top">
  <div class="wrap">
    <div>
      <p class="eyebrow">{e(c.get("locality") or "Dental care")}</p>
      <h1>{name} · Dentist</h1>
      <p class="lead">{hero_desc}</p>
      <div class="cta-row">
        {f'<a class="btn btn-wa" href="{wa}">Contact</a>' if wa else ''}
        {'<a class="btn btn-ghost" href="#services">Explore</a>' if treatments else (f'<a class="btn btn-ghost" href="tel:{phone}">{phone}</a>' if phone else '')}
      </div>
      <div class="trust">
        {f'<span><b>{rating:.1f}★</b> on Google</span>' if rating else ''}
        {f'<span><b>{len(treatments)}</b> treatments</span>' if treatments else ''}
        {f'<span><b>{len(dentists)}</b> {"dentist" if len(dentists)==1 else "dentists"}</span>' if dentists else ''}
      </div>
    </div>
    {hero_media}
  </div>
</section>

{treatments_html}
{gallery_html}
{dentists_html}
{reviews_html}
{stats_html}

<section id="about" class="sec visit">
  <div class="wrap">
    <div>
      <p class="eyebrow">Visit us</p>
      <h2>Opening hours</h2>
      <ul class="hours">{hours_html}</ul>
    </div>
    <div>
      <p class="eyebrow">Find us</p>
      <h2>{name}</h2>
      {about_html}
      {f'<p class="sub">{address}</p>' if address else ''}
      <div class="cta-row" style="margin-top:0">
        <a class="btn btn-solid" href="{maps}">Open in Maps</a>
        {f'<a class="btn btn-wa" href="{wa}">WhatsApp us</a>' if wa else ''}
      </div>
    </div>
  </div>
</section>

{book_band}

<footer>
  <div class="wrap">
    <div>
      <b>{name}</b>
      <p class="fblurb">{about or tagline}</p>
    </div>
    <div>
      <b>Quick Links</b><br>
      <a href="#top">Home</a><br>
      {'<a href="#services">Products &amp; Services</a><br>' if treatments else ''}
      <a href="#about">About</a><br>
      <a href="#contact">Contact</a>
    </div>
    <div>
      <b>Contact</b><br>
      {f'{address}<br>' if address else ''}
      {f'<a href="tel:{phone}">{phone}</a><br>' if phone else ''}
      {f'Reg. {e(c.get("license_number"))}' if _looks_like_reg(c.get("license_number")) else ''}
    </div>
  </div>
  <div class="wrap credit">Copyright © {datetime.utcnow():%Y} {name}. Website by MolarPlus.</div>
</footer>

</body>
</html>'''
