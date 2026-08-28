#!/usr/bin/env python3
"""
Find, and where it is unambiguously safe, resolve accounts that differ only by
the case of their email address.

    python scripts/merge_duplicate_accounts.py            # report, changes nothing
    python scripts/merge_duplicate_accounts.py --apply    # also resolve the safe ones

## How these got created

Every email lookup used to compare exactly, including the uniqueness check at
signup. So `Dr@x.com` could be registered while `dr@x.com` already existed. The
usual way it happened was not two signups: it was one clinic pressing "Continue
with Google" on an account they had created with a password. Google always
returns the address lower-cased, the exact-match lookup found nothing, and a
second brand-new account was created and dropped into onboarding with none of
their data. The customer's reading of that screen is "the app has deleted my
patients".

New ones can no longer be created: lookups and uniqueness checks are
case-insensitive now and addresses are stored lower-cased. This script is only
for the pairs already sitting in the table.

## What it will and will not do

It resolves exactly one shape, the one the bug above produces: a group where
one row is real and every other row is an **empty shell** with no clinic and
nothing in the database pointing at it. For those it

  1. moves the Firebase UID from the shell onto the real account, so the next
     Google sign-in lands on the real clinic instead of making the shell again,
  2. clears the shell's email so it stops colliding, and
  3. deactivates the shell rather than deleting it, so the row is still there
     if any of this needs to be understood later.

Anything else is reported and left completely alone. Two rows that both have
data is a real merge: it means deciding whose patients, whose invoices and
whose audit history survive, across the 44 tables that reference a user. That
is a judgement call about a specific clinic's records, not something a script
should make at 3am. The report gives the reference counts so a person can.

Nothing is written without --apply, and every write is inside one transaction
that rolls back on any error.
"""
import argparse
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, inspect as sa_inspect

from database import SessionLocal
from models import Base, User


def _referencing_columns():
    """Every (table, column) in the schema that points at users.id.

    Read from the metadata rather than written out by hand, because there are
    44 of them today and a hardcoded list would be wrong the first time
    somebody adds a table.
    """
    found = []
    for table in Base.metadata.sorted_tables:
        for column in table.columns:
            for fk in column.foreign_keys:
                if fk.column.table.name == "users" and fk.column.name == "id":
                    found.append((table, column))
    return found


def _inbound_counts(db, refs, user_id):
    """How many rows across the whole schema point at this user."""
    counts = {}
    for table, column in refs:
        n = db.query(func.count()).select_from(table).filter(column == user_id).scalar() or 0
        if n:
            counts[f"{table.name}.{column.name}"] = n
    return counts


def _describe(user, counts):
    bits = [
        f"id={user.id}",
        f"email={user.email!r}",
        f"clinic_id={user.clinic_id}",
        f"role={user.role}",
        f"active={user.is_active}",
        f"password={'yes' if user.password_hash else 'no'}",
        f"firebase={'yes' if user.supabase_user_id else 'no'}",
        f"created={user.created_at.date() if user.created_at else '?'}",
    ]
    line = "      " + "  ".join(bits)
    if counts:
        line += "\n         referenced by: " + ", ".join(
            f"{k}={v}" for k, v in sorted(counts.items())
        )
    else:
        line += "\n         referenced by: nothing"
    return line


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true",
                    help="actually write the safe resolutions (default: report only)")
    args = ap.parse_args()

    db = SessionLocal()
    refs = _referencing_columns()
    print(f"Scanning users against {len(refs)} referencing columns.\n")

    groups = defaultdict(list)
    for user in db.query(User).filter(User.email.isnot(None)).all():
        key = (user.email or "").strip().lower()
        if key:
            groups[key].append(user)

    dupes = {k: v for k, v in groups.items() if len(v) > 1}

    if not dupes:
        print("No case-variant duplicates found. Nothing to do.")
        db.close()
        return 0

    print(f"Found {len(dupes)} address(es) held by more than one account.\n")

    resolvable, needs_a_human = [], []

    for address, users in sorted(dupes.items()):
        detail = {u.id: _inbound_counts(db, refs, u.id) for u in users}
        # "Real" means it has a clinic, or something in the database points at
        # it. Either is enough to mean deleting it would lose something.
        real = [u for u in users if u.clinic_id or detail[u.id]]
        shells = [u for u in users if u not in real]

        print(f"  {address}   ({len(users)} accounts)")
        for u in users:
            tag = "REAL " if u in real else "shell"
            print(f"    [{tag}]")
            print(_describe(u, detail[u.id]))

        if len(real) == 1 and shells:
            resolvable.append((address, real[0], shells))
            print(f"    -> safe: keep id={real[0].id}, retire "
                  f"{', '.join(str(s.id) for s in shells)}")
        else:
            needs_a_human.append(address)
            reason = ("no row has any data" if not real
                      else f"{len(real)} rows both have data")
            print(f"    -> LEFT ALONE: {reason}. Decide this one by hand.")
        print()

    print("-" * 68)
    print(f"  safe to resolve : {len(resolvable)}")
    print(f"  needs a human   : {len(needs_a_human)}")
    if needs_a_human:
        for a in needs_a_human:
            print(f"      {a}")

    if not args.apply:
        print("\nReport only. Re-run with --apply to resolve the safe ones.")
        db.close()
        return 0

    if not resolvable:
        print("\nNothing safe to apply.")
        db.close()
        return 0

    print(f"\nApplying {len(resolvable)} resolution(s)...")
    try:
        for address, keep, shells in resolvable:
            keep.email = (keep.email or "").strip().lower()
            for shell in shells:
                # The Firebase UID is the whole point. Without moving it, the
                # next Google sign-in recreates exactly this situation.
                if shell.supabase_user_id and not keep.supabase_user_id:
                    keep.supabase_user_id = shell.supabase_user_id
                    print(f"    {address}: moved Firebase UID {shell.id} -> {keep.id}")
                # MOVED, not copied. Leaving it on the shell as well would put
                # the same UID on two rows, and get_user_by_supabase_id neither
                # filters on is_active nor tolerates ambiguity — it takes
                # .first(). A Google sign-in could then land on the retired
                # shell, get a token, and be refused on the very next request,
                # which is the lockout this whole script exists to undo.
                shell.supabase_user_id = None
                # A password on the shell and none on the survivor would
                # otherwise be silently thrown away.
                if shell.password_hash and not keep.password_hash:
                    keep.password_hash = shell.password_hash
                    print(f"    {address}: moved password hash {shell.id} -> {keep.id}")

                shell.email = None
                shell.is_active = False
                print(f"    {address}: retired shell id={shell.id}")
        db.commit()
        print("\nDone. Committed.")
    except Exception as e:
        db.rollback()
        print(f"\nFAILED, rolled back, nothing changed: {e}")
        db.close()
        return 1

    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
