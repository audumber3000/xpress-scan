"""The treatment plan the patient is handed.

It is the one clinical document a patient is asked to sign, so these pin what
makes it one: who proposes what to whom, until when the fees hold, the chart
and every finding on it in words, a priced plan whose total adds up, the terms,
and a place for both signatures. And the things it must never do: print a
blank fee as free, print the medical history, or fall over on a chart some
older client saved in a shape nobody expects any more.
"""
import datetime
import re
from types import SimpleNamespace as NS

import pytest

from domains.clinical.treatment_plan_pdf import VALID_DAYS, render_treatment_plan

SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10'/></svg>"


def _paper(**over):
    base = dict(
        id=123,
        date=datetime.datetime(2026, 9, 10, 20, 30),  # UTC; 11 Sep in India
        chief_complaint='["Pain in upper right back tooth"]',
        clinical_examination="Deep caries 16 MO",
        diagnosis="Irreversible pulpitis 16",
        next_visit_recommendation="Review After 1 Week",
        next_visit_date=datetime.date(2026, 9, 17),
        allergies=["Penicillin"],
        medical_history=["Diabetes"],
        dental_chart_snapshot={
            "3": {"condition": "sound", "work": "planned", "workType": "root_canal",
                  "surfaces": {"O": "caries", "M": "caries"}, "conditions": ["pulpitis"],
                  "findings": ["Deep caries"], "status": "planned"},
            "19": {"status": "rootCanal", "marks": ["abscess"]},
            "30": {"surfaces": {"O": "filling_amalgam"}, "conditions": ["attrition"]},
            "8": {"condition": "sound", "surfaces": {}, "conditions": []},
        },
        tooth_notes_snapshot={"3": "Prefers two visits"},
        perio_chart_snapshot={"bpe": {"s1": "2", "s3": "3*"}},
        treatment_plan_snapshot=[
            {"tooth": 3, "surfaces": ["M", "O"], "procedure": "Root canal treatment",
             "diagnosis": "Irreversible pulpitis", "cost": 6500, "status": "planned"},
            {"tooth": 32, "procedure": "Surgical extraction", "cost": 0, "status": "planned"},
            {"tooth": None, "teeth": [23, 24], "procedure": "Scaling", "cost": 1500,
             "status": "in-progress"},
            {"tooth": 8, "procedure": "Composite restoration", "cost": 1800, "status": "completed"},
        ],
    )
    base.update(over)
    return NS(**base)


CLINIC = NS(name="Royal Smile Dental Care", tagline="Gentle care", address="12 MG Road, Pune",
            phone="+91 98765 43210", email="hello@royalsmile.in", license_number="MH-40213",
            license_authority="MSDC", primary_color="#2a276e", logo_url=None,
            timezone="Asia/Kolkata")
PATIENT = NS(id=7, display_id="100234", name="Priya Deshpande", age=34, gender="female",
             phone="+91 99887 76655", date_of_birth=None)
DENTIST = NS(name="Dr. A. Chaudhari", qualifications="BDS, MDS", signature_url=None)


def _render(paper=None, clinic=CLINIC, patient=PATIENT, chart_svg=SVG, dentist=DENTIST):
    return render_treatment_plan(paper or _paper(), clinic, patient, "", "₹",
                                 chart_svg=chart_svg, dentist=dentist)


def _text(html):
    """The words a reader sees, without the markup between them."""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))


# ── who, what, when ────────────────────────────────────────────────────────

def test_it_identifies_the_plan_and_how_long_its_fees_hold():
    from core.clinic_time import clinic_today
    text = _text(_render())
    issued = clinic_today(CLINIC)
    assert "Treatment Plan" in text
    assert "TP-00123" in text
    assert issued.strftime("%d %b %Y") in text
    assert (issued + datetime.timedelta(days=VALID_DAYS)).strftime("%d %b %Y") in text


def test_it_names_the_clinic_patient_and_dentist():
    text = _text(_render())
    for expected in ("Royal Smile Dental Care", "12 MG Road, Pune", "Reg. no. MH-40213 (MSDC)",
                     "Priya Deshpande", "#100234", "34 yrs / Female", "+91 99887 76655",
                     "Dr. A. Chaudhari", "BDS, MDS"):
        assert expected in text, expected


def test_the_visit_is_dated_in_the_clinics_timezone():
    """20:30 UTC on the 10th is the 11th in India. The exam happened on the 11th."""
    assert "Examined on 11 Sep 2026" in _text(_render())


def test_it_carries_the_assessment():
    text = _text(_render())
    assert "Pain in upper right back tooth" in text
    assert "Irreversible pulpitis 16" in text
    assert "Screening score 3* of 4" in text


# ── the chart ──────────────────────────────────────────────────────────────

def test_the_chart_is_drawn_with_a_legend_of_what_it_uses():
    html = _render()
    assert SVG in html
    text = _text(html)
    assert "Dental chart" in text
    assert "Planned work" in text          # tooth 3
    assert "Periapical abscess" in text    # tooth 19's mark
    assert "Implant" not in text           # not on this chart, so not in the legend
    assert "FDI" in text


def test_without_a_chart_image_every_finding_is_still_there_in_words():
    html = _render(chart_svg="")
    assert "<svg" not in html
    text = _text(html)
    assert "Tooth by tooth" in text
    assert "Dental chart" not in text
    assert "Pulpitis, Caries (MO)" in text


def test_findings_are_written_per_tooth_in_fdi():
    text = _text(_render())
    # Universal 3 is FDI 16: its conditions, its decay by surface, its planned work, its notes.
    assert "16 Pulpitis, Caries (MO) Root canal, planned Deep caries; Prefers two visits" in text
    # A chart saved before condition and work were split still reads as work.
    assert "36 Periapical abscess Root canal" in text
    assert "46 Attrition Amalgam filling (O)" in text


def test_a_healthy_tooth_gets_no_row():
    """Universal 8 (FDI 11) has an empty record. A table of teeth saying
    'nothing' hides the ones that matter."""
    rows = re.findall(r"<td class='tooth'>(\d+)</td>", _render().split("Proposed treatment")[0])
    assert "11" not in rows
    assert set(rows) == {"16", "36", "46"}


# ── the plan and its money ─────────────────────────────────────────────────

def test_work_still_to_do_comes_before_work_already_done():
    text = _text(_render())
    assert text.index("To be done") < text.index("Root canal treatment") \
        < text.index("Already completed") < text.index("Composite restoration")


def test_the_totals_add_up_and_leave_out_what_is_not_priced():
    text = _text(_render())
    assert "Treatment still to be done ₹8,000" in text     # 6500 + 1500, extraction unpriced
    assert "Treatment already completed ₹1,800" in text
    assert "Estimated total ₹9,800" in text


def test_a_zero_or_blank_fee_is_to_be_confirmed_never_free():
    """The drawer stores a blank fee as 0. '₹0' next to an extraction reads as free."""
    text = _text(_render())
    assert "Surgical extraction Planned 1 To be confirmed" in text
    assert "₹0" not in text
    assert "1 item is still to be priced" in text


def test_several_unpriced_items_are_counted():
    plan = [{"tooth": 3, "procedure": "A", "cost": ""}, {"tooth": 4, "procedure": "B"}]
    text = _text(_render(_paper(treatment_plan_snapshot=plan)))
    assert "2 items are still to be priced" in text
    assert "Estimated total ₹0" in text


def test_one_status_means_no_group_headings():
    plan = [{"tooth": 3, "procedure": "A", "cost": 100}]
    text = _text(_render(_paper(treatment_plan_snapshot=plan)))
    assert "To be done" not in text and "Already completed" not in text
    assert "Treatment still to be done" not in text
    assert "Estimated total ₹100" in text


def test_combined_work_names_every_tooth_and_general_work_names_none():
    plan = [{"tooth": None, "teeth": [23, 24, 25], "procedure": "Scaling", "cost": 100},
            {"tooth": None, "procedure": "Consultation", "cost": 100}]
    text = _text(_render(_paper(treatment_plan_snapshot=plan)))
    assert "32, 31, 41 Scaling" in text
    assert "General Consultation" in text


def test_an_empty_plan_says_so():
    text = _text(_render(_paper(treatment_plan_snapshot=[])))
    assert "No treatment has been planned yet." in text


# ── terms and signatures ───────────────────────────────────────────────────

def test_it_carries_the_terms_and_both_signature_lines():
    text = _text(_render())
    assert "This is an estimate, not a bill." in text
    assert "I agree to go ahead with the treatment listed above." in text
    assert "Patient or guardian signature" in text
    assert "Dentist signature" in text
    assert "Name: Priya Deshpande" in text
    assert "Dr. A. Chaudhari, BDS, MDS" in text


def test_the_dentists_signature_is_printed_when_on_file():
    sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    html = _render(dentist=NS(name="Dr. X", qualifications="", signature_url=sig))
    assert f"src='{sig}'" in html


def test_the_medical_history_is_never_printed():
    """It goes out over WhatsApp. The consent line asks the patient to confirm
    their history instead."""
    text = _text(_render())
    assert "Penicillin" not in text and "Diabetes" not in text
    assert "medical history" in text


# ── things that must not break it ──────────────────────────────────────────

def test_user_copy_has_no_dashes_standing_in_for_punctuation():
    html = _render()
    assert "—" not in html and "–" not in html


def test_markup_in_clinical_text_is_escaped():
    plan = [{"tooth": 3, "procedure": "<script>x</script>", "cost": 1}]
    html = _render(_paper(treatment_plan_snapshot=plan, diagnosis="<b>bold</b>"))
    assert "<script>x" not in html and "&lt;script&gt;" in html
    assert "<b>bold" not in html


def test_a_quote_in_a_name_cannot_break_the_page_footer():
    clinic = NS(**{**vars(CLINIC), "name": 'Dr "Smile" Clinic'})
    patient = NS(**{**vars(PATIENT), "name": 'Anna "Ann" K'})
    html = _render(clinic=clinic, patient=patient)
    assert 'content: "Dr \\"Smile\\" Clinic' in html
    assert 'content: "Anna \\"Ann\\" K"' in html


@pytest.mark.parametrize("chart,plan", [
    ('{"3": {"conditions": "caries", "marks": "abscess", "surfaces": ["O"], "findings": "x"}}', "not json"),
    ([1, 2, 3], {"not": "a list"}),
    ({"3": None, "x": "text", "5": {"status": 7}}, [None, 5, "text", {"cost": "abc", "qty": "two"}]),
    (None, None),
])
def test_malformed_snapshots_render_rather_than_crash(chart, plan):
    html = _render(_paper(dental_chart_snapshot=chart, treatment_plan_snapshot=plan,
                          tooth_notes_snapshot="nope", perio_chart_snapshot=[1]))
    assert "Treatment Plan" in html


def test_it_renders_with_the_bare_minimum():
    paper = NS(id=1, date=None, dental_chart_snapshot=None, treatment_plan_snapshot=None)
    html = render_treatment_plan(paper, None, NS(name="A"), "", "₹")
    text = _text(html)
    assert "Treatment Plan" in text and "No treatment has been planned yet." in text


# ── the route ──────────────────────────────────────────────────────────────

@pytest.fixture
def paper(client, auth_headers, test_patient):
    r = client.post("/api/v1/clinical/case-papers", headers=auth_headers, json={
        "patient_id": test_patient.id,
        "date": "2026-09-11T05:00:00",
        "dental_chart_snapshot": {"3": {"conditions": ["pulpitis"]}},
        "treatment_plan_snapshot": [{"tooth": 3, "procedure": "Root canal", "cost": 5000}],
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture
def captured(monkeypatch, tmp_path):
    """Keep the HTML the route rendered; skip WeasyPrint for speed."""
    seen = {}

    def fake(html, *a, **k):
        seen["html"] = html
        path = tmp_path / "plan.pdf"
        path.write_bytes(b"%PDF-1.4 fake")
        return str(path)

    monkeypatch.setattr("domains.infrastructure.services.pdf_service.html_template_to_pdf", fake)
    return seen


def test_post_draws_the_chart_the_browser_sent(client, auth_headers, paper, captured):
    r = client.post(f"/api/v1/clinical/case-papers/{paper['id']}/treatment-plan-pdf",
                    json={"chart_svg": SVG}, headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf"
    assert SVG in captured["html"]
    assert "Root canal" in captured["html"]


def test_post_drops_a_chart_that_could_reach_outside_the_request(client, auth_headers, paper, captured):
    evil = "<svg><image href='file:///etc/passwd'/></svg>"
    r = client.post(f"/api/v1/clinical/case-papers/{paper['id']}/treatment-plan-pdf",
                    json={"chart_svg": evil}, headers=auth_headers)
    assert r.status_code == 200
    assert "<svg" not in captured["html"]
    assert "Tooth by tooth" in captured["html"]


def test_get_still_works_without_a_chart(client, auth_headers, paper, captured):
    r = client.get(f"/api/v1/clinical/case-papers/{paper['id']}/treatment-plan-pdf",
                   headers=auth_headers)
    assert r.status_code == 200
    assert "Pulpitis" in captured["html"]


def test_another_clinics_plan_is_not_found(client, auth_headers, captured, db_session):
    from models import CasePaper, Clinic, Patient
    other = Clinic(name="Elsewhere")
    db_session.add(other)
    db_session.flush()
    pat = Patient(clinic_id=other.id, name="Someone", phone="9000000000")
    db_session.add(pat)
    db_session.flush()
    cp = CasePaper(clinic_id=other.id, patient_id=pat.id)
    db_session.add(cp)
    db_session.commit()
    r = client.post(f"/api/v1/clinical/case-papers/{cp.id}/treatment-plan-pdf",
                    json={"chart_svg": SVG}, headers=auth_headers)
    assert r.status_code == 404
    assert "html" not in captured
