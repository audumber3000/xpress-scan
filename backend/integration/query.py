"""Serving a *list* rather than a *feed*.

The sync and the CRM's tables ask the same endpoints for different things. The
sync wants every row that changed since a timestamp, in a stable order, resumed
by an opaque cursor — that is `wire.apply_keyset` and it stays exactly as it is.
A table on a screen wants page 3 of the accounts matching "smile", sorted by MRR
descending, and it wants to know there are 312 of them.

This module is the second half. It exists because the CRM stopped keeping a copy
of the product's tables: a Twenty view can only query Twenty's database, so a
list of subscriptions rendered from Twenty meant subscriptions living in Twenty.
Serving the list from here is what lets that copy go away.

Three rules it enforces, all of them about failing loudly:

**An unknown sort field is a 422.** Silently falling back to a default produces
a list that looks sorted and is not, and the operator trusts it.

**`total` is only computed when the caller asked for a page.** A COUNT on every
sync request would be paid by the one caller that has no use for it.

**Filters are declared per resource, not accepted generically.** A query language
at the boundary is a second CRM: it lets the caller reach shapes the product
never meant to expose, and every product would have to implement all of it.
"""
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import func, or_

from .wire import ContractError

MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 25


class Browse:
    """The UI half of a list request. Absent `page` means the caller is a feed."""

    def __init__(self, q: Optional[str] = None, sort: Optional[str] = None,
                 page: Optional[int] = None, page_size: Optional[int] = None,
                 group_by: Optional[str] = None):
        self.q = (q or "").strip() or None
        self.sort = (sort or "").strip() or None
        self.page = page
        self.page_size = min(page_size or DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
        self.group_by = (group_by or "").strip() or None

    @property
    def paging(self) -> bool:
        return self.page is not None

    @property
    def offset(self) -> int:
        return max(0, (self.page or 1) - 1) * self.page_size


def search(query, term: Optional[str], columns: Sequence[Any]):
    """Case-insensitive contains, across the columns a resource declares.

    Deliberately not full-text. The question a support screen asks is "which of
    these is the one I am looking at", over a few hundred rows, and `ILIKE` on
    a name answers it without a search index to keep in step with the table.
    """
    if not term:
        return query
    pattern = "%%%s%%" % term.replace("%", r"\%").replace("_", r"\_")
    return query.filter(or_(*[column.ilike(pattern) for column in columns]))


def order(query, spec: Optional[str], allowed: Dict[str, Any], default: Any):
    """`field:asc|desc`, checked against an allowlist.

    The allowlist is the resource's own map of contract field name to column, so
    a caller sorts by what the contract promised rather than by what the product
    happens to store — `mrr` is a sort the CRM can ask for whether or not the
    product keeps a column called that.
    """
    if not spec:
        return query.order_by(default)
    field, _, direction = spec.partition(":")
    column = allowed.get(field.strip())
    if column is None:
        raise ContractError(
            422, "unsortable_field",
            "%r is not a sortable field on this resource" % field,
            {"field": field, "sortable": sorted(allowed)})
    if direction.strip().lower() not in ("", "asc", "desc"):
        raise ContractError(422, "bad_sort_direction",
                            "sort direction must be asc or desc",
                            {"direction": direction})
    return query.order_by(column.desc() if direction.strip().lower() == "desc"
                          else column.asc())


def page(query, browse: Browse, serialise: Callable[[List[Any]], List[Any]]) -> Dict[str, Any]:
    """One page, plus the count a table needs to say "1–25 of 312".

    The count is a second query rather than a window function because it has to
    survive the joins these endpoints carry, and because it is only paid on the
    path that asked for it.
    """
    total = query.order_by(None).count()
    rows = query.offset(browse.offset).limit(browse.page_size).all()
    return {
        "data": serialise(rows),
        "page": browse.page,
        "page_size": browse.page_size,
        "total": total,
        "has_more": browse.offset + len(rows) < total,
    }


def group(query, field: str, allowed: Dict[str, Any],
          metrics: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Counts, and any declared sums, by one dimension.

    This is what a Kanban column header and a "MRR by tier" table need, and it
    is the reason neither has to exist as a copied table in the CRM. The
    dimension is allowlisted for the same reason the sort is.

    Returned as a flat list rather than a map so the order is the product's to
    choose — a tier ladder reads wrong in alphabetical order.
    """
    column = allowed.get(field)
    if column is None:
        raise ContractError(
            422, "ungroupable_field",
            "%r is not a groupable field on this resource" % field,
            {"field": field, "groupable": sorted(allowed)})

    selections = [column.label("key"), func.count().label("count")]
    names: List[str] = []
    for name, expression in (metrics or {}).items():
        names.append(name)
        selections.append(expression.label(name))

    rows = query.order_by(None).with_entities(*selections).group_by(column).all()
    groups = []
    for row in rows:
        entry: Dict[str, Any] = {"key": row.key, "count": row.count, "metrics": {}}
        for name in names:
            entry["metrics"][name] = getattr(row, name)
        groups.append(entry)
    return {"groups": groups}


def in_memory_page(rows: List[Any], browse: Browse,
                   serialise: Callable[[List[Any]], List[Any]]) -> Dict[str, Any]:
    """The same envelope, for the filters SQL cannot express.

    Two subscription filters — `at_branch_limit` and `entitlement_mismatch` —
    are decided by `core.plans`, which is Python: entitlement depends on an
    auto-downgrade rule that reads a status and a period end together, and
    re-implementing that rule in SQL would put the product's most consequential
    business logic in two places and let them disagree about who may use what.

    So those two narrow in SQL to a candidate set the rule could possibly be
    true for, and decide in Python. Honest at MolarPlus's size — the candidate
    set is subscriptions in a handful of states, not the table — and it is
    declared here rather than discovered later as a slow endpoint.
    """
    total = len(rows)
    start = browse.offset
    visible = rows[start:start + browse.page_size]
    return {
        "data": serialise(visible),
        "page": browse.page,
        "page_size": browse.page_size,
        "total": total,
        "has_more": start + len(visible) < total,
    }


def parse_bool(value: Optional[str]) -> Optional[bool]:
    """Tri-state: absent means "do not filter", which is not the same as false."""
    if value is None or value == "":
        return None
    if value.lower() in ("true", "1", "yes"):
        return True
    if value.lower() in ("false", "0", "no"):
        return False
    raise ContractError(422, "bad_boolean", "expected true or false",
                        {"value": value})


def csv(value: Optional[str]) -> Optional[List[str]]:
    """`status=active,past_due` — the shape every one of these filters is a list."""
    if not value:
        return None
    parts = [part.strip() for part in value.split(",") if part.strip()]
    return parts or None
