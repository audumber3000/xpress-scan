-- Migration: move every unpaid clinic onto the Plus plan
-- Date: 2026-08-23
-- Description: The free tier is retired. Every clinic that is not currently
--              paying (and not mid-trial) is granted Plus at no charge for a
--              period running 30 Jul 2026 to 30 Sep 2026.
--
-- Safe to re-run: YES. Guarded by a marker row in applied_data_migrations, so a
--                 second run is a no-op even after a clinic has changed plan.
--                 That guard is the point: this migration CHANGES DATA, and
--                 re-running it unguarded would overwrite decisions made after
--                 the first run.
--
-- NOT wired into deploy.sh / deploy-aws.sh on purpose. Run it by hand when the
-- pricing change actually goes live:
--
--   AWS/RDS:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--               -f backend/database/migrations/2026_08_23_plans_v2_free_to_plus.sql
--   Docker:   docker exec -i molarplus-db-1 psql -U postgres -d molarplus \
--               -v ON_ERROR_STOP=1 \
--               < backend/database/migrations/2026_08_23_plans_v2_free_to_plus.sql
--
-- Before running, confirm the published dates match: molarplus.com/pricing and
-- the sales PDF still say free access until 31 October 2026, which contradicts
-- the 30 September end date set below.
--
-- Depends on: applied_data_migrations (created by deploy.sh) and the
--             provider='migration' exemption in domains/clinic/routes/
--             subscriptions.py, which keeps the 7-day Pro trial available to
--             every clinic this touches.

CREATE TABLE IF NOT EXISTS applied_data_migrations (
  key VARCHAR PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

DO $do$
DECLARE
  v_start CONSTANT timestamp := '2026-07-30 00:00:00';
  v_end   CONSTANT timestamp := '2026-09-30 23:59:59';
BEGIN
  IF EXISTS (SELECT 1 FROM applied_data_migrations WHERE key = 'plans_v2_free_to_plus_v1') THEN
    RAISE NOTICE 'plans_v2_free_to_plus already applied, skipping';
    RETURN;
  END IF;

  -- Rows that must NOT be touched, defined once and used twice below:
  -- anyone currently paying us, and anyone mid-trial. Deliberately generous
  -- about what counts as paying (an active card provider OR a settled payment
  -- row, matched by subscription or by clinic) because the cost of wrongly
  -- skipping a clinic is that they keep a better plan for free, and the cost of
  -- wrongly migrating one is taking away something they bought.
  --
  -- A running trial is left alone rather than cut short. When it ends the
  -- existing auto-downgrade in get_current_subscription drops the clinic to the
  -- entry plan on its own, so those clinics still arrive at Plus.
  CREATE TEMP TABLE _mig_protected ON COMMIT DROP AS
    SELECT s.id
      FROM subscriptions s
     WHERE s.status = 'active'
       AND (s.current_end IS NULL OR s.current_end > NOW())
       AND (
             s.is_trial = TRUE
          OR s.provider IN ('cashfree', 'razorpay')
          OR EXISTS (
               SELECT 1 FROM subscription_payments p
                WHERE p.status = 'paid'
                  AND (p.subscription_id = s.id
                       OR (s.clinic_id IS NOT NULL AND p.clinic_id = s.clinic_id))
             )
           );

  -- 1. Existing rows: everything that is not protected becomes Plus.
  --    trial_used is deliberately absent from the SET list. A clinic that has
  --    already had its 7 days keeps that fact; one that has not keeps its
  --    entitlement, and subscriptions.py exempts provider='migration' from the
  --    "you already have an active plan" guard so it can still be taken.
  UPDATE subscriptions s
     SET plan_name     = 'plus',
         status        = 'active',
         provider      = 'migration',
         is_trial      = FALSE,
         current_start = v_start,
         current_end   = v_end,
         updated_at    = NOW()
   WHERE s.id NOT IN (SELECT id FROM _mig_protected);

  -- 2. Clinics with no subscription row at all. Most free clinics are in this
  --    state: get_current_subscription synthesises a response for them, so
  --    nothing ever wrote a row. They need an INSERT, not an UPDATE.
  INSERT INTO subscriptions (
      clinic_id, user_id, plan_name, status, provider,
      is_trial, trial_used, current_start, current_end,
      quantity, created_at, updated_at, sync_status
  )
  SELECT c.id,
         (SELECT u.id FROM users u
           WHERE u.clinic_id = c.id
             AND u.role = 'clinic_owner'
             AND u.is_active = TRUE
           ORDER BY u.id LIMIT 1),
         'plus', 'active', 'migration',
         FALSE, FALSE, v_start, v_end,
         1, NOW(), NOW(), 'local'
    FROM clinics c
   WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.clinic_id = c.id);

  -- 3. clinics.subscription_plan is what /auth/me and the mobile app read, so
  --    it has to agree with the subscription row.
  UPDATE clinics c
     SET subscription_plan = 'plus'
   WHERE EXISTS (
           SELECT 1 FROM subscriptions s
            WHERE s.clinic_id = c.id AND s.provider = 'migration'
         );

  INSERT INTO applied_data_migrations (key) VALUES ('plans_v2_free_to_plus_v1');
END
$do$;

-- What it did, for the deploy log.
SELECT provider,
       plan_name,
       status,
       COUNT(*) AS clinics,
       MIN(current_end) AS period_ends
  FROM subscriptions
 GROUP BY provider, plan_name, status
 ORDER BY provider, plan_name;
