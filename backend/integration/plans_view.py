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
from typing import Any, Dict, Optional

from sqlalchemy import case

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


# ── The catalogue, as SQL ────────────────────────────────────────────────────
#
# Sorting a list of subscriptions by MRR and grouping one by tier are questions
# a database has to answer, because the alternative is loading every row to sort
# it in Python — the thing the CRM stopped doing when these lists moved here.
#
# Every expression below is *built from the catalogue* rather than written out,
# so a price change or a new tier moves the sort with it. A hand-written CASE
# would be one more copy of the price list, which is the mistake this whole
# change exists to undo.


def _cases(column, value_of) -> Any:
    """A CASE over every name the catalogue knows, retired aliases included.

    Aliases matter: production has written `professional_annual` and rows still
    say so. Leaving them out would sort every legacy subscription into the same
    null bucket at one end of the list.
    """
    mapping: Dict[str, Any] = {}
    for key in plans.PLANS:
        for cycle in ("monthly", "annual"):
            mapping[plans.stored_name(key, cycle)] = value_of(key, cycle)
    for alias, target in plans.LEGACY_ALIASES.items():
        resolved_key, resolved_cycle = plans.resolve(target)
        mapping.setdefault(alias, value_of(resolved_key, resolved_cycle))
        mapping.setdefault(alias + _ANNUAL, value_of(resolved_key, "annual"))
    return case(mapping, value=column, else_=value_of(plans.DEFAULT_PLAN, "monthly"))


def tier_expression(column):
    """`plan_name` → `plus` / `pro` / `growth`, for GROUP BY."""
    return _cases(column, lambda key, _cycle: key)


def cycle_expression(column):
    """`plan_name` → `monthly` / `annual`, for GROUP BY."""
    return _cases(column, lambda _key, cycle: cycle)


def rank_expression(column):
    """`plan_name` → the tier's position on the ladder, for ORDER BY.

    Sorting on the tier *name* puts growth before plus, alphabetically, which
    is the opposite of what anybody reading a list of plans expects.
    """
    return _cases(column, lambda key, _cycle: plans.PLANS[key]["rank"])


def mrr_expression(column, currency: str = plans.INR):
    """`plan_name` → list-price MRR in micros, for ORDER BY and SUM.

    The same normalisation `monthly_mrr_micros` does, in SQL. List price: what
    an account is actually charged, after coupons and part periods, is
    `/payments`, and a revenue figure should be built from that.
    """
    return _cases(
        column,
        lambda key, cycle: monthly_mrr_micros(plans.stored_name(key, cycle), currency),
    )
