"""The parent-clinic shim: how MolarPlus answers "what is an account?".

**This is a shim, and it is meant to be read as one.**

The contract's account is an organisation — the dental group that receives the
bill — and its branches are the sites it runs. MolarPlus has no organisation.
`clinics` is the tenant root: all twelve dependent tables hang off `clinic_id`,
subscriptions and payments included, and a multi-branch group is expressed only
as a nullable `parent_clinic_id` pointing at another clinic row.

So this module promotes the parent clinic:

    clinics
     ├─ 42  parent_clinic_id = NULL  →  the ACCOUNT, and also its first branch
     ├─ 43  parent_clinic_id = 42    →  a branch
     └─ 44  parent_clinic_id = 42    →  a branch

A standalone clinic is its own account and its own sole branch.

**Chosen deliberately on 2026-09-05, not by default.** The alternative — a real
`organisations` table with the subscription moved onto it — is the actual fix
and is what SyrupDesk already has. It is a migration against a live production
database in the product repo, and it is the largest single piece of work the
contract creates. Until it lands, MolarPlus cannot offer group billing to a
chain, and most accounts have exactly one branch. That is a tolerable Phase 2
state. It is not a tolerable end state.

**Account ids are prefixed `clinic:` for exactly that reason.** The CRM stores
`Company.externalIds = {"molarplus": "clinic:42"}`. When organisations land,
ids become `org:900` and the sync sees the scheme change instead of silently
matching account `42` against a completely different organisation that happens
to share the number. A rename is loud; a silent wrong merge is not.
"""
import datetime
from typing import List

from sqlalchemy import or_, select
from sqlalchemy.orm import aliased

from models import Clinic

from .wire import ContractError

ACCOUNT_ID_PREFIX = "clinic:"

# COALESCE fallback for rows predating a timestamp column. Any fixed instant in
# the past works; what matters is that the sort key is never NULL, because a
# NULL on either side of the keyset row comparison makes it neither true nor
# false and the page comes back empty.
EPOCH = datetime.datetime(1970, 1, 1)


def account_id(clinic_id) -> str:
    return "{}{}".format(ACCOUNT_ID_PREFIX, clinic_id)


def parse_account_id(raw: str) -> int:
    """`"clinic:42"` → `42`, strictly.

    The bare form `"42"` is rejected on purpose. It would work today and become
    a silent mis-match the day account ids stop being clinic ids.
    """
    if not raw.startswith(ACCOUNT_ID_PREFIX):
        raise ContractError(
            404, "account_not_found",
            "No account with id {}. MolarPlus account ids look like "
            "'clinic:42' — see integration/org.py.".format(raw),
            {"account_id": raw},
        )
    tail = raw[len(ACCOUNT_ID_PREFIX):]
    if not tail.isdigit():
        raise ContractError(
            404, "account_not_found", "No account with id {}".format(raw), {"account_id": raw},
        )
    return int(tail)


def is_account_root():
    """SQL predicate: this `clinics` row is an account in its own right.

    Three ways to be one, and the last two are defensive. A row whose
    `parent_clinic_id` points at itself, or at a clinic that no longer exists,
    is a branch of nothing — without these it would belong to no account, and
    an account that quietly stops appearing in the CRM is close to impossible
    to notice.
    """
    parent = aliased(Clinic)
    return or_(
        Clinic.parent_clinic_id.is_(None),
        Clinic.parent_clinic_id == Clinic.id,
        ~select(parent.id).where(parent.id == Clinic.parent_clinic_id).exists(),
    )


def belongs_to(member, account_clinic_id: int):
    """SQL predicate: `member` (an aliased Clinic) is a site of this account.

    The account's own row is one of its branches. That is not a special case to
    tidy away later: a single-site clinic genuinely is both, and the contract's
    `branch_count` has to count it.
    """
    return or_(member.id == account_clinic_id, member.parent_clinic_id == account_clinic_id)


def member_join(member):
    """The same predicate as a correlated join condition, for the roll-ups."""
    return or_(member.id == Clinic.id, member.parent_clinic_id == Clinic.id)


def group_ids(db, account_clinic_id: int) -> List[int]:
    """Every clinic id in this account, the account's own row included."""
    rows = db.query(Clinic.id).filter(belongs_to(Clinic, account_clinic_id)).all()
    return [row[0] for row in rows]


def account_of(db, clinic: Clinic) -> Clinic:
    """The account a clinic belongs to — itself, or its parent."""
    if clinic.parent_clinic_id and clinic.parent_clinic_id != clinic.id:
        parent = db.query(Clinic).filter(Clinic.id == clinic.parent_clinic_id).first()
        if parent is not None:
            return parent
    return clinic
