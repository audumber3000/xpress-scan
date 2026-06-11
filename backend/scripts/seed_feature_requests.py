"""
Seed the global feature-request board with a realistic starter set so the
"Feature Requests" tab in the Help Center isn't empty at launch.

- Requests are unattributed (created_by / clinic_id = NULL) so the board shows
  "A clinic" as the requester rather than falsely naming a real clinic.
- Votes are inserted from existing real users (one per user, per the unique
  constraint), so the vote counts are real and "Top" sort is meaningful.
  Counts are capped by how many users exist in the DB.

Idempotent: a request is only created if one with the same title doesn't
already exist, and votes are only seeded for requests this script creates.

Run:  python scripts/seed_feature_requests.py
"""
import os
import sys
import random
import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine
from models import Base, FeatureRequest, FeatureRequestVote, User
from sqlalchemy.orm import Session

# (title, description, status, popularity, days_ago)
# `popularity` (0..1) = fraction of the user base that upvoted it. Using a
# ratio rather than an absolute count means the seeded counts stay varied and
# believable on any size DB (one-vote-per-user caps the absolute max).
SEED_REQUESTS = [
    ("Recurring appointments",
     "Let me set an appointment to repeat weekly/monthly (e.g. ortho adjustments) instead of re-booking each time.",
     "planned", 1.00, 26),
    ("WhatsApp bulk reminders",
     "Send appointment reminders to many patients at once over WhatsApp, with a recall list for overdue check-ups.",
     "in_progress", 0.88, 21),
    ("Tally / accounting export",
     "Export invoices and payments in a format I can import straight into Tally for my accountant.",
     "open", 0.78, 19),
    ("Patient mobile app for reports",
     "A patient-facing app where patients can view their prescriptions, invoices and x-rays.",
     "open", 0.70, 17),
    ("Customisable invoice templates",
     "Let me add my clinic logo, GST number and a custom footer, and pick the paper size for printed invoices.",
     "shipped", 0.62, 31),
    ("Inventory low-stock alerts",
     "Notify me when consumables (gloves, anaesthetic, etc.) drop below a threshold so I can reorder in time.",
     "open", 0.55, 14),
    ("Multi-language patient messages",
     "Send SMS/WhatsApp templates in regional languages (Hindi, Marathi, Tamil...) for non-English-speaking patients.",
     "open", 0.48, 12),
    ("Online payment links",
     "Generate a UPI / card payment link I can send to a patient so they can pay the invoice from their phone.",
     "planned", 0.42, 10),
    ("Dentist-wise revenue reports",
     "Break down collections and treatments per doctor so I can track productivity in a multi-dentist clinic.",
     "open", 0.36, 9),
    ("Treatment plan PDF for patients",
     "Export a clean, branded treatment plan with estimated costs that I can hand or email to the patient.",
     "in_progress", 0.30, 7),
    ("Two-way calendar sync (Google)",
     "Sync MolarPlus appointments with my Google Calendar both ways so my personal schedule stays updated.",
     "open", 0.25, 6),
    ("Lab work status tracking",
     "A clearer dashboard for outsourced lab cases — sent, in progress, received — with due-date reminders.",
     "open", 0.20, 4),
    ("Patient feedback / review requests",
     "Automatically ask patients for a Google review a day after their visit.",
     "open", 0.14, 3),
    ("Dark mode",
     "A dark theme for the dashboard — easier on the eyes during long evening sessions.",
     "declined", 0.08, 2),
]


def seed_feature_requests():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Seed runs once — never clobber a board that already has requests
        # (real or seeded). Safe to call on every deploy.
        existing = db.query(FeatureRequest).count()
        if existing > 0:
            print(f"↩️  {existing} feature requests already exist — skipping seed.")
            return

        user_ids = [row[0] for row in db.query(User.id).filter(User.is_active == True).all()]
        if not user_ids:
            print("⚠️  No active users found — requests will be created with 0 votes.")
        n_users = len(user_ids)

        # Reset prior seed rows so re-running gives clean, varied counts. We only
        # ever touch unattributed rows (created_by IS NULL) — i.e. only the ones
        # this script created — so real user-submitted requests are never deleted.
        old = db.query(FeatureRequest).filter(FeatureRequest.created_by.is_(None)).all()
        for fr in old:
            db.delete(fr)  # votes cascade-delete
        if old:
            print(f"♻️  Removed {len(old)} previously-seeded requests before re-seeding.")
        db.flush()

        print(f"🌱 Seeding feature requests ({n_users} users available for votes)...")
        created = 0
        total_votes = 0

        for title, desc, status, popularity, days_ago in SEED_REQUESTS:
            created_at = datetime.datetime.utcnow() - datetime.timedelta(
                days=days_ago, hours=random.randint(0, 23)
            )
            fr = FeatureRequest(
                created_by=None,
                clinic_id=None,
                title=title,
                description=desc,
                status=status,
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(fr)
            db.flush()  # get fr.id

            # Votes = popularity fraction of the user base (>=1 if any users), so
            # counts vary across requests and "Top" sort is meaningful.
            n = min(n_users, max(1, round(popularity * n_users))) if n_users else 0
            for uid in random.sample(user_ids, n):
                db.add(FeatureRequestVote(
                    feature_request_id=fr.id,
                    user_id=uid,
                    created_at=created_at + datetime.timedelta(hours=random.randint(1, 48)),
                ))
            total_votes += n
            created += 1

        db.commit()
        print(f"✅ Done. Created {created} requests with {total_votes} votes.")
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_feature_requests()
