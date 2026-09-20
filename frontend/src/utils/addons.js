import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { isIndia } from './plans';

/**
 * Add-ons, client side. The sibling of utils/plans.js.
 *
 * The server is the source of truth: `GET /subscriptions/addons` returns every
 * add-on priced for this clinic and carrying this clinic's own state (included
 * in its plan, active until, free grace period, coming soon...). The table
 * below exists only so the first paint has cards to draw, and it can never
 * claim a clinic owns something: every card starts as not bought, or coming
 * soon, until the server says otherwise.
 *
 * Keep the numbers in step with backend/core/addons.py. If they disagree the
 * server wins and the only symptom is a price that flickers on load.
 *
 * India only for now, and the same rule as plans: no dollar figure, ever. A
 * clinic outside India gets no prices at all here, only "contact us".
 */

const INR = 'INR';

const FALLBACK_ADDONS = [
  {
    key: 'own_whatsapp',
    label: 'Your own WhatsApp number',
    description: "Patient reminders, invoices and prescriptions go out from your clinic's own WhatsApp number.",
    icon: 'whatsapp',
    availability: 'live',
    fulfilment: 'auto',
    price: { monthly: 289, annual: 2774 },
    included_from_plan: 'Pro',
    manage_link: '/admin/integrations/whatsapp',
  },
  {
    key: 'gbp_management',
    label: 'Google Business Profile management',
    description: 'We get your phone number, timings and clinic details updated and approved on Google for you.',
    icon: 'google_business',
    availability: 'live',
    fulfilment: 'managed',
    price: { monthly: 150, annual: 1440 },
    included_from_plan: 'Pro',
    manage_link: null,
  },
  {
    key: 'upi_payments',
    label: 'UPI payments with QR',
    description: 'Patients pay by UPI QR at the desk, and the bill marks itself paid once the bank confirms.',
    icon: 'upi',
    availability: 'coming_soon',
    fulfilment: 'auto',
    price: { monthly: 200, annual: 1920 },
    included_from_plan: 'Pro',
    manage_link: '/admin/integrations/payments',
  },
  {
    key: 'xray_integration',
    label: 'RVG and X-ray integration',
    description: "Vatech, Carestream and other sensors, captured straight into the patient's file.",
    icon: 'xray',
    availability: 'coming_soon',
    fulfilment: 'auto',
    price: { monthly: 350, annual: 3360 },
    included_from_plan: 'Pro',
    manage_link: '/admin/integrations/xray',
  },
];

export const SERVICE_STEPS = ['requested', 'access_given', 'in_progress', 'done'];

export const SERVICE_STEP_LABELS = {
  requested: 'Requested',
  access_given: 'Access given',
  in_progress: 'In progress',
  done: 'Done',
};

export function fallbackAddonCatalogue() {
  // Same rule, same helper as the plan catalogue: an unknown country is India.
  const india = isIndia();
  return {
    currency: india ? INR : null,
    tax_rate: india ? 0.18 : 0,
    tax_label: india ? 'GST' : null,
    service_steps: SERVICE_STEPS,
    gbp_manager_email: null,
    addons: FALLBACK_ADDONS.map((a) => {
      const priced = india && !!a.price;
      const monthly = priced ? a.price.monthly : null;
      const annual = priced ? a.price.annual : null;
      return {
        key: a.key,
        label: a.label,
        description: a.description,
        icon: a.icon,
        availability: a.availability,
        fulfilment: a.fulfilment,
        currency: priced ? INR : null,
        monthly,
        annual_total: annual,
        annual_monthly: annual ? Math.round((annual / 12) * 100) / 100 : null,
        annual_pct_off: annual && monthly ? Math.round((1 - annual / (monthly * 12)) * 100) : null,
        priced,
        included_by_plan: false,
        included_from_plan: a.included_from_plan,
        state: a.availability === 'coming_soon' ? 'coming_soon' : (india ? 'not_bought' : 'unavailable'),
        cycle: null,
        source: null,
        current_end: null,
        service_status: null,
        manage_link: a.manage_link,
      };
    }),
  };
}

const isUsable = (data) => !!data && Array.isArray(data.addons) && data.addons.every((a) => a.key && a.state);

export function useAddonCatalogue({ enabled = true } = {}) {
  const [catalogue, setCatalogue] = useState(fallbackAddonCatalogue);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await api.get('/subscriptions/addons');
      if (isUsable(data)) {
        setCatalogue(data);
        setFailed(false);
      } else {
        console.warn('[addons] /subscriptions/addons returned an unrecognised shape; using built-in cards.', data);
      }
    } catch {
      // The fallback cards stay up, but nothing on them can say "active",
      // so the tab says it could not load the clinic's add-ons.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { reload(); }, [reload]);

  return { catalogue, loading, failed, reload };
}

/** "14 Oct 2026" from an ISO date the server sent. */
export function formatAddonDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
