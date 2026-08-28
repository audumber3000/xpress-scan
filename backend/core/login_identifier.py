"""
How a typed login identifier is matched against the users table.

The rule lives here rather than in each repository because there are a dozen
places that look a user up by what they typed — web login, mobile login, the
OAuth sync, forgot-password, the account preview, staff invitations — and until
they all agreed, an account could be findable by one of them and invisible to
the others. That is not a cosmetic inconsistency: it is what makes an account
unrecoverable, because the screen that says "we couldn't find that email" and
the screen that would have let them back in disagree about what "find" means.

The rule is: compare on the trimmed, lower-cased form of both sides.

An email address's domain is case-insensitive by definition, no mail provider
in practice treats the local part as case-sensitive, and a phone keyboard
capitalises the first letter whether the person wanted it or not. So
``Dr.Sharma@Gmail.com`` and ``dr.sharma@gmail.com`` are one account, and the
same goes for a staff username typed as ``Reception1`` on one device and
``reception1`` on another.

## Why exact still wins

Matching loosely would be enough on its own if the data were clean, but it is
not: the uniqueness check at signup used to be case-sensitive too, so it was
possible to register ``Dr@x.com`` while ``dr@x.com`` already existed. Both rows
can still be sitting there. On those, a purely case-insensitive lookup would
return whichever row the database happened to hand back first, which could
silently sign somebody into the wrong account.

So every lookup tries the exact string first and only falls back to the loose
comparison when nothing matched exactly. Someone typing their address exactly
as they registered it always lands on their own row; the loose pass only ever
rescues a login that would otherwise have failed outright.

## A note on indexes

``lower(trim(col))`` cannot use the plain index on email or username, so the
fallback pass is a sequential scan. On a users table of this size that is
irrelevant, and it only runs when the exact lookup already came back empty. If
the table ever grows enough for it to matter, the fix is a functional index on
``lower(email)`` rather than going back to exact matching.
"""
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models import User


def normalize_email(raw: Optional[str]) -> str:
    """The form an email address is STORED in. Use on every write path."""
    return (raw or "").strip().lower()


def normalize_identifier(raw: Optional[str]) -> str:
    """Tidy up what was typed into a login box. Whitespace only.

    Case is deliberately left alone here: this is what gets shown back to the
    user and recorded in the audit trail, and the comparison below lower-cases
    both sides anyway. Passwords are never touched — a space can be a real
    character in one.
    """
    return (raw or "").strip()


def identifier_matches(identifier: str):
    """A clause matching email OR username, ignoring case and stray spaces."""
    ident = normalize_identifier(identifier).lower()
    return or_(
        func.lower(func.trim(User.email)) == ident,
        func.lower(func.trim(User.username)) == ident,
    )


def email_matches(email: str):
    """A clause matching the email column alone, ignoring case and spaces."""
    return func.lower(func.trim(User.email)) == normalize_email(email)


def find_user_by_email(db: Session, email: str) -> Optional[User]:
    """Exact match first, then the case-insensitive fallback. See module docs."""
    typed = normalize_identifier(email)
    if not typed:
        return None
    exact = db.query(User).filter(User.email == typed).first()
    return exact or db.query(User).filter(email_matches(typed)).first()


def find_user_by_identifier(db: Session, identifier: str) -> Optional[User]:
    """As above, but the identifier may be an email or a staff username."""
    typed = normalize_identifier(identifier)
    if not typed:
        return None
    exact = (
        db.query(User)
        .filter(or_(User.email == typed, User.username == typed))
        .first()
    )
    return exact or db.query(User).filter(identifier_matches(typed)).first()


def find_active_user_by_identifier(db: Session, identifier: str) -> Optional[User]:
    """The sign-in lookup: email or username, active accounts only.

    Separate from the function above because the login route needs both. This
    one decides whether to let somebody in; the unfiltered one is what tells a
    deactivated person WHY they are being refused, instead of leaving them to
    conclude they have forgotten their own password.
    """
    typed = normalize_identifier(identifier)
    if not typed:
        return None
    exact = (
        db.query(User)
        .filter(
            or_(User.email == typed, User.username == typed),
            User.is_active == True,  # noqa: E712 - SQL comparison, not Python
        )
        .first()
    )
    if exact:
        return exact
    return (
        db.query(User)
        .filter(identifier_matches(typed), User.is_active == True)  # noqa: E712
        .first()
    )


def normalize_username(raw: Optional[str]) -> str:
    """Whitespace only, deliberately.

    Unlike an email address, a username is something an owner typed and then
    reads back in the staff list, so ``DrSharma`` stays ``DrSharma`` on screen.
    Case-insensitivity is delivered by ``username_matches`` at lookup time
    instead, which is where it actually matters.
    """
    return (raw or "").strip()


def username_matches(username: str):
    """A clause matching the username column, ignoring case and stray spaces."""
    return func.lower(func.trim(User.username)) == normalize_username(username).lower()
