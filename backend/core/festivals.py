"""Major Indian festivals, for the dashboard's ambient strip.

─── Why this is a hand-checked table and not a library ─────────────────────

Most Indian festivals are lunisolar: Diwali moves by about three weeks a year,
Eid by eleven days, and the arithmetic differs by tradition and by region. A
panchang library would be a dependency, a licence and a source of quiet
disagreements with whatever calendar the clinic actually keeps on its wall.

For a strip that says "Diwali is on Sunday" a table is both smaller and more
honest: every date is one somebody checked, and when it is wrong it is wrong
visibly and fixably rather than subtly.

Sources: the DoPT central gazetted holiday lists for 2026 and 2027, plus
drikpanchang for the widely-observed festivals that are not centrally gazetted
(Ganesh Chaturthi, Raksha Bandhan, Makar Sankranti). Checked 2026-09-20.

─── ⚠ THIS TABLE EXPIRES ───────────────────────────────────────────────────

It runs out on 2027-12-25. `upcoming()` returns None past the end rather than
guessing, so the strip simply stops showing festivals — it never shows a wrong
one. Extend it before the end of 2027. `coverage_ends()` is here so a health
check can warn before a user notices.

─── What is in, and what is not ────────────────────────────────────────────

National and pan-religious: the central gazetted list covers Hindu, Muslim,
Christian, Sikh, Jain and Buddhist observances, which is the right shape for a
clinic greeting every patient who walks in.

Deliberately excluded: state-specific festivals. Onam, Pongal, Bihu and Gudi
Padwa are all major to the people who keep them and invisible to everyone else,
and a Kerala festival announced to a Punjab clinic is noise. If per-state
festivals are ever wanted, they belong behind the clinic's own state, not here.
"""
import datetime
from typing import Optional

# (ISO date, display name, illustration key)
#
# The illustration key maps to the flat art set in the frontend's ambientArt.
# Several festivals deliberately share one: the strip is 28 pixels of colour
# next to a name, not an attempt to depict each observance.
FESTIVALS = [
    # ── 2026, from the date this table was written ──────────────────────────
    ("2026-10-02", "Gandhi Jayanti", "flag"),
    ("2026-10-20", "Dussehra", "lantern"),
    ("2026-11-08", "Diwali", "diya"),
    ("2026-11-24", "Guru Nanak Jayanti", "sparkle"),
    ("2026-12-25", "Christmas", "tree"),

    # ── 2027 ────────────────────────────────────────────────────────────────
    ("2027-01-14", "Makar Sankranti", "kite"),
    ("2027-01-26", "Republic Day", "flag"),
    ("2027-03-10", "Eid al-Fitr", "moon"),
    ("2027-03-23", "Holi", "colors"),
    ("2027-03-26", "Good Friday", "sparkle"),
    ("2027-04-15", "Ram Navami", "sparkle"),
    ("2027-04-19", "Mahavir Jayanti", "sparkle"),
    ("2027-05-17", "Bakrid", "moon"),
    ("2027-05-20", "Buddha Purnima", "sparkle"),
    ("2027-06-16", "Muharram", "moon"),
    ("2027-08-15", "Independence Day", "flag"),
    ("2027-08-17", "Raksha Bandhan", "rakhi"),
    ("2027-08-25", "Janmashtami", "sparkle"),
    ("2027-09-04", "Ganesh Chaturthi", "modak"),
    ("2027-10-02", "Gandhi Jayanti", "flag"),
    ("2027-10-09", "Dussehra", "lantern"),
    ("2027-10-29", "Diwali", "diya"),
    ("2027-11-14", "Guru Nanak Jayanti", "sparkle"),
    ("2027-12-25", "Christmas", "tree"),
]

# How far ahead the strip looks. Three weeks is roughly when a clinic starts
# planning around a holiday — far enough to be useful, near enough that the
# line still reads as news rather than trivia.
LOOKAHEAD_DAYS = 21


def coverage_ends() -> datetime.date:
    """Last date this table knows about. For monitoring, so the data runs out
    on somebody's dashboard before it runs out on a clinic's."""
    return datetime.date.fromisoformat(FESTIVALS[-1][0])


def upcoming(today: datetime.date, within_days: int = LOOKAHEAD_DAYS) -> Optional[dict]:
    """The next festival on or within `within_days` of `today`, else None.

    Returns None rather than the nearest match when the table has run out, so
    an out-of-date deploy shows nothing instead of something wrong.
    """
    for iso, name, icon in FESTIVALS:
        day = datetime.date.fromisoformat(iso)
        if day < today:
            continue
        away = (day - today).days
        if away > within_days:
            return None
        return {
            "name": name,
            "date": iso,
            "icon": icon,
            "days_away": away,
            # The phrasing belongs next to the arithmetic. "in 2 days" and
            # "Tomorrow" are the same number and very different sentences.
            "when": (
                "Today" if away == 0
                else "Tomorrow" if away == 1
                else day.strftime("%A")  if away < 7
                else day.strftime("%a, %-d %b")
            ),
        }
    return None
