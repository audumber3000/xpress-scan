"""The insurance estimate, which is the number a patient argues about.

Pure maths, no database, no fixtures — so these run everywhere and stay fast.
The worked example is the one in Open Dental's own documentation, kept as a case
so a refactor cannot quietly change what a patient is quoted.
"""
import pytest

from domains.insurance.estimator import estimate_lines, normalise_category

PLAN = {
    "coverage": {"preventive": 100, "basic": 80, "major": 50, "ortho": 50},
    "deductible": 50, "deductible_met": 0,
    "annual_max": 1000, "annual_used": 0,
}


def split(lines, policy=PLAN):
    r = estimate_lines([{"description": "x", **l} for l in lines], policy)
    return r["insurance_estimate"], r["patient_portion"]


def test_industry_worked_example():
    # 125 filling, 80% basic, 50 deductible unmet:
    # deductible takes 50, insurer pays 80% of the remaining 75 = 60.
    assert split([{"amount": 125, "benefit_category": "basic"}]) == (60.0, 65.0)


def test_deductible_is_taken_once_across_lines():
    """The commonest way this is got wrong: charging the deductible per line."""
    assert split([{"amount": 125, "benefit_category": "basic"}] * 4) == (360.0, 140.0)


def test_deductible_already_met():
    assert split([{"amount": 125, "benefit_category": "basic"}],
                 {**PLAN, "deductible_met": 50}) == (100.0, 25.0)


def test_preventive_still_pays_the_deductible_first():
    """100% cover does not mean the deductible is skipped."""
    assert split([{"amount": 200, "benefit_category": "preventive"}]) == (150.0, 50.0)


def test_annual_maximum_caps_the_insurer_not_the_patient():
    ins, pat = split([{"amount": 5000, "benefit_category": "major"}],
                     {**PLAN, "deductible": 0})
    assert ins == 1000.0
    assert pat == 4000.0


def test_annual_maximum_already_exhausted():
    assert split([{"amount": 5000, "benefit_category": "major"}],
                 {**PLAN, "deductible": 0, "annual_used": 1000}) == (0.0, 5000.0)


def test_missing_annual_maximum_means_unlimited_not_zero():
    """A blank ceiling must not be read as a ceiling of nothing."""
    assert split([{"amount": 5000, "benefit_category": "major"}],
                 {"coverage": {"major": 50}, "deductible": 0, "annual_max": None}) == (2500.0, 2500.0)


def test_no_policy_leaves_the_whole_bill_with_the_patient():
    assert split([{"amount": 125, "benefit_category": "basic"}], None) == (0.0, 125.0)


def test_policy_with_no_percentages_pays_nothing_and_does_not_crash():
    assert split([{"amount": 100, "benefit_category": "basic"}],
                 {"coverage": {}, "deductible": 0, "annual_max": None}) == (0.0, 100.0)


def test_zero_cost_line_does_not_consume_the_deductible():
    r = estimate_lines([{"description": "Free", "amount": 0, "benefit_category": "basic"}], PLAN)
    assert r["deductible_applied"] == 0.0


def test_mixed_bands_share_one_deductible_and_one_ceiling():
    ins, pat = split([
        {"amount": 200, "benefit_category": "preventive"},
        {"amount": 125, "benefit_category": "basic"},
        {"amount": 4000, "benefit_category": "major"},
    ])
    assert ins == 1000.0          # the annual maximum
    assert pat == 3325.0
    assert ins + pat == 4325.0    # and nothing is lost between them


@pytest.mark.parametrize("given", ["nonsense", "", None, "  basic  ", "MAJOR"])
def test_category_is_normalised_once_so_the_estimate_matches_its_own_label(given):
    """A line reported as 'basic' must be priced as basic.

    These were resolved separately at first, so a typo'd category was labelled
    basic in the response and priced at 0%.
    """
    r = estimate_lines([{"description": "x", "amount": 100, "benefit_category": given}],
                       {**PLAN, "deductible": 0})
    line = r["lines"][0]
    assert line["benefit_category"] == normalise_category(given)
    expected_pct = PLAN["coverage"][line["benefit_category"]]
    assert line["benefit_percent"] == expected_pct
    assert line["insurance_estimate"] == round(100 * expected_pct / 100, 2)


def test_totals_always_reconcile():
    r = estimate_lines(
        [{"description": str(i), "amount": 137.77, "benefit_category": "basic"} for i in range(7)],
        PLAN)
    assert round(r["insurance_estimate"] + r["patient_portion"], 2) == r["total"]
