"""What the insurer is expected to pay, and what the patient owes.

One function, used by both quotations and invoices, so the figure a patient is
quoted is produced by the same code as the figure they are later billed. Two
implementations would drift, and the drift would show up as an argument at the
counter.

The order of operations is the part people get wrong, and it is the order every
dental plan is written in:

    1. the deductible comes off the fee first, and only what is left is shared;
    2. the insurer pays its percentage of that remainder;
    3. the annual maximum caps the insurer's total, never the patient's;
    4. whatever the insurer does not pay, the patient does.

Worked through: a 125 filling at 80% basic with a 50 deductible not yet met.
The deductible takes 50, leaving 75. The insurer pays 80% of 75 = 60. The
patient pays 125 - 60 = 65 — the 50 deductible plus the 15 coinsurance.

Everything here is an estimate and is named as one. Only the payer knows the
real answer, and only after adjudicating.
"""
from typing import Optional

BENEFIT_CATEGORIES = ("preventive", "basic", "major", "ortho")
DEFAULT_CATEGORY = "basic"


def normalise_category(value) -> str:
    """Fold anything unrecognised onto the default band.

    Done once, and used for both the percentage lookup and the value reported
    back. They were resolved separately at first, so a line with a typo'd
    category was labelled "basic" in the response while being priced at 0% —
    the estimate and its own explanation disagreed, which is the worst way for
    this to be wrong.
    """
    c = (value or "").strip().lower()
    return c if c in BENEFIT_CATEGORIES else DEFAULT_CATEGORY


def _num(v, default=0.0) -> float:
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def estimate_lines(lines, policy: Optional[dict]):
    """Split each line into an insurer share and a patient share.

    `lines` is [{description, amount, benefit_category}]. `policy` is the
    patient's cover as a dict, or None when they have none.

    The deductible and the annual maximum are consumed across the lines in
    order, because they are per-plan-year pots rather than per-line rules. A
    quotation for four procedures must not apply the same 50 deductible four
    times, which is the single most common way this is got wrong.
    """
    if not policy:
        return {
            "covered": False,
            "lines": [
                {**_line_shape(l), "insurance_estimate": 0.0,
                 "patient_portion": _num(l.get("amount"))}
                for l in lines
            ],
            "total": sum(_num(l.get("amount")) for l in lines),
            "insurance_estimate": 0.0,
            "patient_portion": sum(_num(l.get("amount")) for l in lines),
            "deductible_applied": 0.0,
            "annual_max_reached": False,
        }

    coverage = policy.get("coverage") or {}
    deductible_left = max(_num(policy.get("deductible")) - _num(policy.get("deductible_met")), 0.0)

    annual_max = policy.get("annual_max")
    # No annual maximum means unlimited, not zero. Treating a blank field as a
    # ceiling of nothing would quietly estimate every insurer contribution at 0.
    insurer_left = (max(_num(annual_max) - _num(policy.get("annual_used")), 0.0)
                    if annual_max not in (None, "") else None)

    out = []
    total = insured = deductible_applied = 0.0
    hit_max = False

    for l in lines:
        amount = _num(l.get("amount"))
        total += amount
        category = normalise_category(l.get("benefit_category"))
        pct = _num(coverage.get(category), 0.0)

        # 1. deductible first, from this line's fee
        taken = min(deductible_left, amount)
        deductible_left -= taken
        deductible_applied += taken
        shareable = amount - taken

        # 2. the insurer's percentage of what is left
        est = shareable * (pct / 100.0)

        # 3. capped by what remains of the annual maximum
        if insurer_left is not None:
            if est >= insurer_left:
                est = insurer_left
                hit_max = True
            insurer_left -= est

        est = round(est, 2)
        insured += est
        out.append({
            **_line_shape(l),
            "benefit_percent": pct,
            "deductible_applied": round(taken, 2),
            "insurance_estimate": est,
            # 4. the remainder is the patient's, and it can never be negative
            "patient_portion": round(max(amount - est, 0.0), 2),
        })

    return {
        "covered": True,
        "lines": out,
        "total": round(total, 2),
        "insurance_estimate": round(insured, 2),
        "patient_portion": round(total - insured, 2),
        "deductible_applied": round(deductible_applied, 2),
        "annual_max_reached": hit_max,
    }


def _line_shape(l):
    return {
        "description": l.get("description"),
        "amount": round(_num(l.get("amount")), 2),
        "benefit_category": normalise_category(l.get("benefit_category")),
    }


def policy_to_dict(pi) -> Optional[dict]:
    """A PatientInsurance row as the estimator wants it."""
    if not pi:
        return None
    return {
        "coverage": pi.coverage or {},
        "deductible": pi.deductible,
        "deductible_met": pi.deductible_met,
        "annual_max": pi.annual_max,
        "annual_used": pi.annual_used,
    }
