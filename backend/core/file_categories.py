"""What a file uploaded to a patient's record actually is.

Two screens show a patient's files: Imaging (films, photos, scans) and
Documents (referrals, reports, estimates, consents). Which one a file belongs on
is decided by this single list, so the two can never both claim it or both
ignore it.

─── Why this exists ─────────────────────────────────────────────────────────

Every upload landed in Documents and Imaging was permanently empty. Three
separate causes, and each on its own was enough:

  1. The upload endpoint did not accept a category at all, so the picker on the
     upload drawer wrote nothing anywhere.
  2. The list endpoint hardcoded `category="document"` on every row, so even a
     stored category was discarded on the way out.
  3. The Imaging tab read `xray_images`, a different table, which nothing the
     clinic could reach ever wrote to — `POST /xray/upload` rejects anything
     that is not a `.dcm` and saves to container-local disk, so it was never
     usable for a JPG off a sensor and would not have survived a deploy anyway.

So imaging is a CATEGORY OF DOCUMENT, stored in R2 like every other file in the
app, and the Imaging tab is a filtered view of the same table. The legacy
`xray_images` rows are still read and shown; nothing new is written there.
"""

# Films, photographs and scans — everything that belongs on the Imaging tab.
# The vocabulary is the clinic's own and is stored verbatim, never translated on
# display, so an export and the screen say the same word.
IMAGING_CATEGORIES = (
    'IOPA',      # single periapical film
    'RVG',       # radiovisiography sensor capture
    'OPG',       # panoramic
    'Bitewing',
    'CBCT',
    'Photo',     # intra-oral or clinical photograph
    'Scan',      # an intra-oral scanner's output, or anything else imaged
)

# Paperwork — everything that belongs on the Documents tab.
DOCUMENT_CATEGORIES = (
    'Report',
    'Referral',
    'Estimate',
    'Insurance',
    'Consent',
    'Other',
)

ALL_CATEGORIES = IMAGING_CATEGORIES + DOCUMENT_CATEGORIES

# What older clients send, and what it means now. The upload drawer offered
# 'X-Ray' and 'Intra-Oral' and threw both away; installed tablets will keep
# sending them for a while, and a file filed under a word no screen filters on
# is a file nobody finds.
LEGACY_CATEGORY_ALIASES = {
    'x-ray': 'IOPA',
    'xray': 'IOPA',
    'intra-oral': 'Photo',
    'intraoral': 'Photo',
    'periapical': 'IOPA',
    'panoramic': 'OPG',
    'document': None,   # the old hardcoded value: means "nobody said", not a kind
    'upload': None,
}

_BY_LOWER = {c.lower(): c for c in ALL_CATEGORIES}


def normalise_category(value):
    """One canonical spelling, or None when nothing usable was sent.

    None is a real answer and is kept as one: a file uploaded before the picker
    existed has no category, and guessing 'Other' for it would be inventing a
    fact. Both screens treat an uncategorised upload as paperwork, which is
    where they have always appeared.
    """
    if not isinstance(value, str):
        return None
    key = value.strip().lower()
    if not key:
        return None
    if key in LEGACY_CATEGORY_ALIASES:
        return LEGACY_CATEGORY_ALIASES[key]
    return _BY_LOWER.get(key)


def is_imaging(value) -> bool:
    """True when this category belongs on the Imaging tab."""
    return normalise_category(value) in IMAGING_CATEGORIES
