"""
Put one clinic into any plan state, look at the app, then put it back.

Testing this by hand otherwise means editing `subscriptions` in psql and
remembering what the row used to be. This backs the row up first, so `--restore`
always works, and prints the restore command as well in case the file is lost.

    # what is clinic 2 on right now?
    python scripts/plan_state_sandbox.py --clinic 2 --show

    # drive it through the states
    python scripts/plan_state_sandbox.py --clinic 2 --state trial_running
    python scripts/plan_state_sandbox.py --clinic 2 --state trial_ended
    python scripts/plan_state_sandbox.py --clinic 2 --state lapsed
    python scripts/plan_state_sandbox.py --clinic 2 --state renewal_due

    # the same state on a different plan
    python scripts/plan_state_sandbox.py --clinic 2 --state lapsed --plan plus
    python scripts/plan_state_sandbox.py --clinic 2 --state renewal_due --plan growth

    # put it back exactly as it was
    python scripts/plan_state_sandbox.py --clinic 2 --restore

After each change, RELOAD the browser. The header banner reads
`user.clinic.plan_state`, which arrives with /auth/me and is cached, so an open
tab keeps showing the previous state until it refetches.

Never touches more than the one clinic you name. There is no "all clinics"
option on purpose.
"""
import argparse
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal                      # noqa: E402
from models import Clinic, Subscription, User          # noqa: E402
from core import plan_state as ps, plans               # noqa: E402

def _backup_dir():
    """Somewhere the backup survives a container rebuild.

    The backend image bakes its code in, so a file written next to this script
    lives inside the container and disappears on the next `up --build` — taking
    the only record of the original subscription row with it. `/app/uploads` is
    bind-mounted to the host in docker-compose.yml, so it outlives the image.
    """
    override = os.getenv("PLAN_SANDBOX_DIR")
    if override:
        return override
    for candidate in ("/app/uploads", os.path.dirname(os.path.abspath(__file__))):
        if os.path.isdir(candidate) and os.access(candidate, os.W_OK):
            return candidate
    return os.getcwd()


BACKUP_DIR = _backup_dir()

# Each state, expressed as the subscription row that produces it.
# `days` is relative to now: negative is in the past.
RECIPES = {
    "healthy":       dict(provider="cashfree", is_trial=False, status="active",  days=25,  plan="pro"),
    "renewal_due":   dict(provider="cashfree", is_trial=False, status="active",  days=2,   plan="pro"),
    "lapsed":        dict(provider="cashfree", is_trial=False, status="active",  days=-1,  plan="pro"),
    "trial_running": dict(provider="trial",    is_trial=True,  status="active",  days=5,   plan="pro"),
    "trial_ended":   dict(provider="trial",    is_trial=True,  status="expired", days=-1,  plan="pro"),
    "grant_due":     dict(provider="migration", is_trial=False, status="active", days=2,   plan="plus"),
    "grant_ended":   dict(provider="migration", is_trial=False, status="active", days=-1,  plan="plus"),
}

FIELDS = ("plan_name", "status", "provider", "is_trial", "trial_used",
          "current_start", "current_end", "trial_ends_at")


def _backup_path(clinic_id):
    return os.path.join(BACKUP_DIR, f".plan_sandbox_clinic_{clinic_id}.json")


def _serialise(sub):
    out = {}
    for f in FIELDS:
        v = getattr(sub, f, None)
        out[f] = v.isoformat() if isinstance(v, dt.datetime) else v
    return out


def _describe(db, clinic):
    sub = (
        db.query(Subscription)
        .filter(Subscription.clinic_id == clinic.id)
        .order_by(Subscription.id.desc())
        .first()
    )
    state = ps.for_clinic(db, clinic)
    effective = plans.effective_plan(
        getattr(sub, "plan_name", None),
        getattr(sub, "status", None),
        getattr(sub, "current_end", None),
    )
    print(f"\n  clinic          {clinic.id}  {clinic.name}")
    print(f"  clinics column  {clinic.subscription_plan!r}")
    if sub:
        print(f"  subscription    plan_name={sub.plan_name!r} status={sub.status!r} "
              f"provider={sub.provider!r} is_trial={sub.is_trial}")
        print(f"  period ends     {sub.current_end}")
    else:
        print("  subscription    (no row)")
    print(f"  effective plan  {plans.label(effective)}")
    print(f"  plan state      {state['state']}   blocks writes: {state['blocks']}")
    if state.get("title"):
        print(f"  header shows    \"{state['title']}\"")
        print(f"  popup says      \"{state['message']}\"")
    print()


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clinic", type=int, required=True, help="clinic id (never 'all')")
    ap.add_argument("--state", choices=sorted(RECIPES), help="state to put it into")
    ap.add_argument("--plan", choices=("plus", "pro", "growth"),
                    help="which plan it was on (default: the recipe's own). "
                         "A lapsed Plus and a lapsed Pro are the same state but "
                         "different sentences, so both are worth looking at.")
    ap.add_argument("--show", action="store_true", help="just report, change nothing")
    ap.add_argument("--restore", action="store_true", help="put the row back as it was")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        clinic = db.query(Clinic).filter(Clinic.id == args.clinic).first()
        if not clinic:
            sys.exit(f"No clinic with id {args.clinic}")

        if args.show or not (args.state or args.restore):
            _describe(db, clinic)
            return

        sub = (
            db.query(Subscription)
            .filter(Subscription.clinic_id == clinic.id)
            .order_by(Subscription.id.desc())
            .first()
        )
        path = _backup_path(clinic.id)

        # ── restore ──────────────────────────────────────────────────────
        if args.restore:
            if not os.path.exists(path):
                sys.exit(f"No backup at {path}. Nothing to restore.")
            saved = json.load(open(path))
            if saved.get("_created_by_sandbox"):
                if sub:
                    db.delete(sub)
                clinic.subscription_plan = saved["_clinic_plan"]
                db.commit()
                os.remove(path)
                print("\n  Removed the subscription row this script created, and put "
                      f"clinics.subscription_plan back to {saved['_clinic_plan']!r}.")
                _describe(db, clinic)
                return
            if not sub:
                sys.exit("The subscription row has gone; cannot restore onto nothing.")
            for f in FIELDS:
                v = saved.get(f)
                if f in ("current_start", "current_end", "trial_ends_at") and v:
                    v = dt.datetime.fromisoformat(v)
                setattr(sub, f, v)
            clinic.subscription_plan = saved["_clinic_plan"]
            db.commit()
            os.remove(path)
            print("\n  Restored.")
            _describe(db, clinic)
            return

        # ── set a state ──────────────────────────────────────────────────
        created = False
        if not sub:
            owner = (
                db.query(User)
                .filter(User.clinic_id == clinic.id, User.role == "clinic_owner")
                .first()
            )
            sub = Subscription(clinic_id=clinic.id, user_id=getattr(owner, "id", None))
            db.add(sub)
            db.flush()
            created = True

        # Back up before the first change only, so repeated runs still restore
        # to the ORIGINAL row rather than to the last sandbox state.
        if not os.path.exists(path):
            snapshot = _serialise(sub)
            snapshot["_clinic_plan"] = clinic.subscription_plan
            snapshot["_created_by_sandbox"] = created
            with open(path, "w") as fh:
                json.dump(snapshot, fh, indent=2)
            print(f"\n  Backed up to {path}")
            print("  If you lose that file, this puts it back by hand:")
            print("    UPDATE subscriptions SET "
                  + ", ".join(
                      f"{f} = " + (
                          "NULL" if snapshot[f] is None
                          else f"'{snapshot[f]}'" if isinstance(snapshot[f], str)
                          else str(snapshot[f]))
                      for f in FIELDS)
                  + f" WHERE clinic_id = {clinic.id};")

        r = RECIPES[args.state]
        now = dt.datetime.utcnow()
        end = now + dt.timedelta(days=r["days"])
        sub.plan_name = args.plan or r["plan"]
        sub.status = r["status"]
        sub.provider = r["provider"]
        sub.is_trial = r["is_trial"]
        sub.current_start = end - dt.timedelta(days=30)
        sub.current_end = end
        if r["is_trial"]:
            sub.trial_used = True
            sub.trial_ends_at = end
        # The clinics column is what the header reads; keep it consistent with
        # what the app itself would have written.
        clinic.subscription_plan = plans.effective_plan(sub.plan_name, sub.status, sub.current_end)
        db.commit()

        print(f"  Clinic {clinic.id} is now in state: {args.state}")
        _describe(db, clinic)
        print("  Reload the browser to pick this up (/auth/me is cached).\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
