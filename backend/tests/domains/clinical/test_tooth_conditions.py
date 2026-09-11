"""What a tooth has, carried from the chart to every page that reports it.

A tooth used to take one of three conditions from a dropdown. It now carries a
list, grouped, with several at once. Three places read a tooth outside the
chart itself — the patient summary PDF, and the input to the AI clinical note —
and each one only prints what it has been told the name of. A condition the
chart saves and those pages do not know is a condition that disappears from the
record the patient and the next dentist actually read.

Four conditions are not in the list on purpose: impacted, fractured and missing
are the tooth's structural state (they change how it is drawn), and periapical
abscess is the existing abscess overlay. Picking one writes to where it already
lives. The parity test below holds the frontend's list and this module's words
to the same set, so neither can grow without the other.
"""
import json
import re
from pathlib import Path
from types import SimpleNamespace as NS

import pytest

from domains.clinical.clinical_summary_pdf import (
    CLINICAL_CONDITION_WORDS, CONDITION_WORDS, MARK_LEGEND, _tooth_rows, clinical_conditions,
)

JS = (Path(__file__).resolve().parents[4]
      / "frontend" / "src" / "components" / "patient" / "dentalConstants.js")


def _js_items():
    """Every condition item in the frontend's CONDITION_GROUPS, as dicts."""
    src = JS.read_text(encoding="utf-8")
    block = src[src.index("export const CONDITION_GROUPS"):src.index("export const CONDITION_ITEMS")]
    items = []
    for m in re.finditer(r"\{\s*value:\s*'([a-z_]+)'.*?\}", block, re.S):
        body = m.group(0)
        items.append({
            "value": m.group(1),
            "structural": (re.search(r"structural:\s*'([a-z_]+)'", body) or [None, None])[1],
            "mark": (re.search(r"mark:\s*'([a-z_]+)'", body) or [None, None])[1],
        })
    return items


# ── The two lists agree ─────────────────────────────────────────────────────

def test_the_frontend_list_is_readable_from_here():
    items = _js_items()
    assert len(items) == 28, "the frontend list changed size; update the words here"


def test_every_listed_condition_has_words_on_the_pdf():
    listed = {i["value"] for i in _js_items() if not i["structural"] and not i["mark"]}
    assert listed == set(CLINICAL_CONDITION_WORDS), (
        f"missing words: {sorted(listed - set(CLINICAL_CONDITION_WORDS))}; "
        f"stale words: {sorted(set(CLINICAL_CONDITION_WORDS) - listed)}")


def test_the_structural_ones_map_to_states_the_pdf_already_names():
    for item in _js_items():
        if item["structural"]:
            assert item["structural"] in CONDITION_WORDS, item


def test_the_abscess_maps_to_the_overlay_the_pdf_already_draws():
    marks = [i["mark"] for i in _js_items() if i["mark"]]
    assert marks == ["abscess"]
    assert "abscess" in MARK_LEGEND


# ── The summary PDF ─────────────────────────────────────────────────────────

def _row_condition(html, fdi):
    m = re.search(rf"<td class='b'>{fdi}</td><td>([^<]*)</td>", html)
    return m.group(1) if m else None


def test_a_tooth_with_conditions_lists_them():
    html = _tooth_rows({"19": {"conditions": ["pulpitis", "gingival_recession"]}}, {})
    assert _row_condition(html, "36") == "Pulpitis, Gingival recession"


def test_the_structural_state_comes_first():
    html = _tooth_rows({"19": {"condition": "fractured", "conditions": ["pulpitis"]}}, {})
    assert _row_condition(html, "36") == "Fractured, Pulpitis"


def test_a_tooth_with_only_a_condition_still_gets_a_row():
    """It used to be skipped: nothing else on it was set, so the row test
    decided the tooth was empty and a patient's erosion never reached paper."""
    assert "46" in _tooth_rows({"30": {"conditions": ["erosion"]}}, {})


def test_an_unknown_condition_is_printed_not_dropped():
    """Added on the frontend before this map learned its name, it should still
    reach the paper — spelled as its key — rather than vanish from the record."""
    assert clinical_conditions({"conditions": ["new_thing"]}) == ["new thing"]


def test_a_chart_saved_before_conditions_existed_renders_as_it_did():
    before = {"19": {"condition": "impacted"}, "30": {"status": "missing"}}
    html = _tooth_rows(before, {})
    assert _row_condition(html, "36") == "Impacted"


@pytest.mark.parametrize("junk", [None, "pulpitis", 7, {"a": 1}, [None, "", 3]])
def test_malformed_condition_lists_do_not_break_the_page(junk):
    _tooth_rows({"19": {"conditions": junk}}, {})


# ── The AI clinical note ────────────────────────────────────────────────────

def test_the_note_writer_is_told_what_the_tooth_has():
    """It is instructed to use only what is recorded, so a condition missing
    from its input comes back as 'omitted' in a note the dentist then trusts."""
    from domains.clinical.routes.case_papers import _notes_input

    cp = NS(
        dental_chart_snapshot={"19": {"condition": "fractured",
                                      "conditions": ["pulpitis", "dentin_hypersensitivity"]}},
        treatment_plan_snapshot=[], tooth_notes_snapshot={}, perio_chart_snapshot={},
        date=None, chief_complaint=None, clinical_examination=None, dental_history=None,
        medical_history=None, allergies=None, diagnosis=None,
        next_visit_recommendation=None, notes=None,
    )
    record = json.loads(_notes_input(cp, []))
    tooth = next(t for t in record["teeth"] if str(t["tooth_fdi"]) == "36")
    assert tooth["condition"] == "Fractured"
    assert tooth["conditions"] == ["Pulpitis", "Dentin hypersensitivity"]
