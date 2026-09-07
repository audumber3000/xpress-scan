"""The two plan questions the contract asks that `core.plans` does not answer.

Both are derived entirely from the product's own catalogue — this module holds
no prices. That matters: a second copy of the price list is a second thing to
update when a plan changes, and the one that nobody remembers is the one the
CRM reports as MRR.

It lives in the integration package rather than in `core/plans.py` for the same
reason everything else here does: the CRM contract is a separate concern from
the product's own APIs, and mixing them makes it unclear which callers a change
would break.
"""
from typing import Optional

from core import plans

MICROS = 1_000_000
_ANNUAL = "_annual"


def is_known(plan_name: Optional[str]) -> bool:
    """Whether this name is one the catalogue actually offers.

    `plans.resolve` is deliberately total — it always returns something — so it
    cannot answer this. The change-plan action needs the strict question: a
    `plan_code` the product does not sell is a 422, not a silent downgrade to
    the entry tier.
    """
    raw = (plan_name or "").strip().lower()
    raw = plans.LEGACY_ALIASES.get(raw, raw)
    if raw.endswith(_ANNUAL):
        raw = raw[: -len(_ANNUAL)]
    return raw in plans.PLANS


def billing_currency(country: Optional[str]) -> str:
    """What a clinic in this country is charged in.

    `plans.billing_currency` takes a clinic row; the contract reads rows from
    several tables and often has only a country code, so this takes the string.
    An unknown country counts as India, matching the product — `clinics.country`
    defaults to 'IN', so a NULL almost certainly is an Indian clinic.
    """
    return plans.INR if (country or "IN").upper() == "IN" else plans.USD


def monthly_mrr_micros(plan_name: Optional[str], currency: str = plans.INR) -> int:
    """The plan's list price normalised to one month, in integer micros.

    Annual plans divide the year's total by twelve. The arithmetic is done in
    micros rather than on the rupee figure so an annual price that does not
    divide evenly — Plus is 3,830 a year — loses nothing to rounding.

    List price, not collected revenue: a coupon or a part payment is not
    reflected here. Actual money is `GET /payments`, which is what any
    revenue-over-time figure should be built from.
    """
    key, cycle = plans.resolve(plan_name)
    table = plans.PLANS[key]["price"].get(currency) or plans.PLANS[key]["price"][plans.INR]
    if cycle == "annual":
        return int(round(table["annual"] * MICROS / 12.0))
    return int(table["monthly"]) * MICROS
