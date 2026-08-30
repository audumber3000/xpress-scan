-- Migration: give every row-less clinic a subscription, and bank the one real
--            Cashfree payment the webhook threw away.
-- Date: 2026-08-30
--
-- Two independent repairs, both caused by the same week:
--
-- 1. THE ROW-LESS CLINICS. Onboarding wrote clinics.subscription_plan='free'
--    and created no subscription row. plans.LEGACY_ALIASES maps free->plus, so
--    those clinics read as Plus everywhere, and plan_state.evaluate(None)
--    returns 'ok' with no end date for a clinic with no row. Nineteen clinics
--    signed up into that state between 25 and 29 Aug 2026 — every signup in
--    the window. They were free, unbilled, unexpiring, and invisible to every
--    warning the state machine can raise.
--
--    They are put on the SAME grant as the other 176 (provider='migration',
--    ending INTRO_GRANT_END) rather than on the new 7-day signup trial. They
--    were shown "Plus" for up to five days and told nothing about a trial;
--    backdating a 7-day clock would have expired five of them before this
--    migration finished running.
--
-- 2. CLINIC 204, skintonik aesthic clinic. They PAID Rs 470.82 for Plus monthly
--    on 2026-08-29 at 14:34:29 IST and got nothing for it. core/cashfree_webhook
--    read Cashfree's millisecond x-webhook-timestamp as seconds, which put every
--    delivery ~56,000 years in the future and failed the freshness window: all
--    eight attempts were rejected 401. On top of that, opening the checkout had
--    already overwritten their live trial row in place, leaving plan_name=plus /
--    status=pending / provider=cashfree while keeping the trial's dates and
--    is_trial flag. Both bugs are fixed in code; this repairs the data.
--
--    Payment facts, recovered from the backend log on the EC2 box:
--      order_id     SUB_204_1787994184_050139
--      cf_order_id  6768886719
--      amount       470.82 INR   (Plus monthly 399 + 18% GST 71.82)
--      paid_at      2026-08-29 09:04:29 UTC   (x-webhook-timestamp 1787994269280)
--
-- Safe to re-run: YES. Guarded by a marker row in applied_data_migrations, and
--                 every statement is additionally guarded on its own so a
--                 partial first run cannot double-charge or double-grant.
--
-- NOT wired into deploy.sh / deploy-aws.sh. Run by hand:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/database/migrations/2026_08_30_signup_subscription_backfill.sql
--
-- Depends on: 2026_08_23_plans_v2_free_to_plus.sql having already run, and on
--             core/plan_bootstrap.py::INTRO_GRANT_END holding the same date as
--             v_grant_end below. If you move one, move the other.

CREATE TABLE IF NOT EXISTS applied_data_migrations (
  key VARCHAR PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

DO $do$
DECLARE
  -- Must match core/plan_bootstrap.py::INTRO_GRANT_END.
  v_grant_end   CONSTANT timestamp := '2026-09-30 23:59:59';
  v_paid_at     CONSTANT timestamp := '2026-08-29 09:04:29';   -- UTC
  v_order_id    CONSTANT varchar   := 'SUB_204_1787994184_050139';
  v_cf_order_id CONSTANT varchar   := '6768886719';
  v_amount      CONSTANT float     := 470.82;
  v_tax         CONSTANT float     := 71.82;
  v_backfilled  integer;
  v_sub_204     integer;
BEGIN
  IF EXISTS (SELECT 1 FROM applied_data_migrations WHERE key = 'signup_subscription_backfill_v1') THEN
    RAISE NOTICE 'signup_subscription_backfill already applied, skipping';
    RETURN;
  END IF;

  -- ── 1. Clinics with no subscription row ────────────────────────────────
  --
  -- current_start is the clinic's own created_at, not now(), so the row says
  -- when the clinic actually started rather than when we noticed.
  --
  -- trial_used stays FALSE: these clinics have never taken a trial, and
  -- provider='migration' is exempt from the "you already have an active plan"
  -- guard in subscriptions.py, so the 7-day Pro trial remains theirs to take.
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
         FALSE, FALSE, c.created_at, v_grant_end,
         1, NOW(), NOW(), 'local'
    FROM clinics c
   WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.clinic_id = c.id);

  GET DIAGNOSTICS v_backfilled = ROW_COUNT;
  RAISE NOTICE 'backfilled % clinic(s) onto the Plus grant', v_backfilled;

  -- ── 2. The clinics column has to agree with the row ────────────────────
  --
  -- 'free' is not a plan any more. It only ever resolved to Plus through
  -- LEGACY_ALIASES, so this changes no clinic's entitlement — it just stops
  -- the database asserting something the catalogue no longer contains.
  UPDATE clinics SET subscription_plan = 'plus' WHERE subscription_plan = 'free';

  -- ── 3. Clinic 204: bank the payment, repair the subscription ───────────
  SELECT id INTO v_sub_204 FROM subscriptions WHERE provider_order_id = v_order_id;

  IF v_sub_204 IS NULL THEN
    RAISE NOTICE 'clinic 204: no subscription for order %, skipping repair', v_order_id;
  ELSIF EXISTS (
      SELECT 1 FROM subscription_payments
       WHERE provider_order_id = v_order_id AND status = 'paid'
  ) THEN
    RAISE NOTICE 'clinic 204: payment for order % already banked, skipping', v_order_id;
  ELSE
    -- The subscription they actually bought: Plus monthly, one month from the
    -- moment the money settled. is_trial goes FALSE because they are no longer
    -- on a trial, but trial_used stays TRUE — they did start one on 29 Aug and
    -- it should not come back to them a second time.
    UPDATE subscriptions
       SET plan_name              = 'plus',
           status                 = 'active',
           provider               = 'cashfree',
           provider_subscription_id = NULL,   -- cf_payment_id never reached us
           is_trial               = FALSE,
           trial_ends_at          = NULL,
           current_start          = v_paid_at,
           current_end            = v_paid_at + INTERVAL '1 month',
           -- `notes` is a json column, not jsonb, so it has no `-` operator.
           -- This row's notes is {} and the only key this migration cares
           -- about (pending_plan) postdates it, so strip via jsonb and cast back.
           notes                  = ((COALESCE(notes, '{}'::json)::jsonb - 'pending_plan')::text)::json,
           updated_at             = NOW()
     WHERE id = v_sub_204;

    INSERT INTO subscription_payments (
        subscription_id, clinic_id, user_id, provider,
        provider_order_id, provider_payment_id, plan_name,
        amount, tax_amount, currency, status, paid_at, created_at
    )
    SELECT v_sub_204, s.clinic_id, s.user_id, 'cashfree',
           v_order_id, v_cf_order_id, 'plus',
           v_amount, v_tax, 'INR', 'paid', v_paid_at, NOW()
      FROM subscriptions s WHERE s.id = v_sub_204;

    UPDATE clinics SET subscription_plan = 'plus' WHERE id = 204;

    RAISE NOTICE 'clinic 204: banked % INR and repaired subscription %', v_amount, v_sub_204;
  END IF;

  INSERT INTO applied_data_migrations (key) VALUES ('signup_subscription_backfill_v1');
END
$do$;

-- ── What it did, for the deploy log ─────────────────────────────────────────
SELECT 'clinics with no subscription row' AS check, COUNT(*)::text AS value
  FROM clinics c WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.clinic_id = c.id)
UNION ALL
SELECT 'clinics still on the retired free plan', COUNT(*)::text FROM clinics WHERE subscription_plan = 'free'
UNION ALL
SELECT 'paid payments on record', COUNT(*)::text FROM subscription_payments WHERE status = 'paid'
UNION ALL
SELECT 'clinic 204 plan', subscription_plan FROM clinics WHERE id = 204;
