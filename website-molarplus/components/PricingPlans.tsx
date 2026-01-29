'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, X, ArrowRight, Phone, MessageCircle } from 'lucide-react';
import { APP_URL } from '@/lib/constants';
import { colors } from '@/lib/seo';

export type CountryCode = 'IN' | 'OTHER';

const FREE_FEATURES = [
  '1 chair, up to 2 employees',
  'Core clinic features',
  'Appointments & patient records',
  'Mobile, web & desktop apps',
  'Data backup & HIPAA compliance',
];

const FREE_EXCLUDED = [
  'Admin controls',
  'WhatsApp & email messaging',
  'Bulk notifications',
];

const PRO_FEATURES = [
  '2–5 chairs',
  'Everything in Free, plus:',
  'Staff attendance',
  'Employee device management',
  'Clinic finance & reports',
  'Bulk WhatsApp, email & notifications',
  'Full admin features',
];

const ENTERPRISE_FEATURES = [
  'Larger clinics & groups',
  'Everything in Pro, plus:',
  'Offline software support',
  'Assisted installation',
  'Dedicated success manager',
];

const PRO_PRICE = { IN: { monthly: 1299, yearly: 11691 }, OTHER: { monthly: 20, yearly: 180 } };
const YEARLY_DISCOUNT = 25; // 25% off = pay 9 months for 12

async function detectCountry(): Promise<CountryCode> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    return data?.country_code === 'IN' ? 'IN' : 'OTHER';
  } catch {
    return 'OTHER';
  }
}

export default function PricingPlans() {
  const [country, setCountry] = useState<CountryCode | null>(null);
  const [overrideCountry, setOverrideCountry] = useState<CountryCode | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showCountrySelect, setShowCountrySelect] = useState(false);

  const effectiveCountry = overrideCountry ?? country ?? 'OTHER';
  const isIndia = effectiveCountry === 'IN';

  useEffect(() => {
    detectCountry().then(setCountry);
  }, []);

  const proMonthly = isIndia ? PRO_PRICE.IN.monthly : PRO_PRICE.OTHER.monthly;
  const proYearly = isIndia ? PRO_PRICE.IN.yearly : PRO_PRICE.OTHER.yearly;
  const currency = isIndia ? '₹' : '$';
  const proPrice = billingCycle === 'monthly' ? proMonthly : proYearly;
  const period = billingCycle === 'monthly' ? '/month' : '/year';

  return (
    <div className="mb-12">
      {/* Country selector */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCountrySelect((s) => !s)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            {isIndia ? '🇮🇳 India (INR)' : '🌐 Other countries (USD)'}
            <span className="text-gray-400">▼</span>
          </button>
          {showCountrySelect && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setShowCountrySelect(false)} />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                <button
                  type="button"
                  onClick={() => {
                    setOverrideCountry('IN');
                    setShowCountrySelect(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm ${effectiveCountry === 'IN' ? 'bg-blue-50 font-medium' : ''}`}
                >
                  🇮🇳 India (INR)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverrideCountry('OTHER');
                    setShowCountrySelect(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm ${effectiveCountry === 'OTHER' ? 'bg-blue-50 font-medium' : ''}`}
                >
                  🌐 Other countries (USD)
                </button>
              </div>
            </>
          )}
        </div>
        <span className="text-gray-500 text-sm">Prices shown in {isIndia ? 'INR' : 'USD'}</span>
      </div>

      {/* Billing toggle (Pro only) */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <span className={`text-lg ${billingCycle === 'monthly' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
          Monthly
        </span>
        <button
          type="button"
          onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
          className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors"
          style={{ backgroundColor: billingCycle === 'yearly' ? colors.primary : '#d1d5db' }}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full bg-white transition-transform ${
              billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={`text-lg ${billingCycle === 'yearly' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
          Yearly <span className="text-green-600 text-sm">(Save {YEARLY_DISCOUNT}%)</span>
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-stretch">
        {/* Free */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Free</h2>
          <p className="text-gray-600 mb-6">For single-chair setups</p>
          <div className="text-center mb-6">
            <span className="text-3xl font-bold text-gray-900">Free</span>
          </div>
          <ul className="space-y-3 mb-6 flex-1">
            {FREE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">{f}</span>
              </li>
            ))}
            {FREE_EXCLUDED.map((f, i) => (
              <li key={i} className="flex items-start gap-2 opacity-60">
                <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-500 text-sm">{f}</span>
              </li>
            ))}
          </ul>
          <a
            href={`${APP_URL}/signup`}
            className="w-full py-3 rounded-lg font-semibold text-center block border-2 border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
          >
            Get Started Free
          </a>
        </div>

        {/* Pro */}
        <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-blue-500 flex flex-col relative scale-105 z-10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Most Popular
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pro</h2>
          <p className="text-gray-600 mb-6">For clinics with 2–5 chairs</p>
          <div className="text-center mb-6">
            <span className="text-4xl font-bold" style={{ color: colors.primary }}>
              {currency}{proPrice}
            </span>
            <span className="text-gray-500 ml-1">{period}</span>
          </div>
          <ul className="space-y-3 mb-6 flex-1">
            {PRO_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">{f}</span>
              </li>
            ))}
          </ul>
          <a
            href={`${APP_URL}/signup`}
            className="w-full py-3 rounded-lg font-semibold text-center block text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: colors.primary }}
          >
            Start Free Trial
          </a>
        </div>

        {/* Enterprise */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h2>
          <p className="text-gray-600 mb-6">For larger clinics</p>
          <div className="text-center mb-6">
            <span className="text-lg font-semibold text-gray-600">Custom pricing</span>
          </div>
          <ul className="space-y-3 mb-6 flex-1">
            {ENTERPRISE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">{f}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3">
            <Link
              href="/contact"
              className="w-full py-3 rounded-lg font-semibold text-center flex items-center justify-center gap-2 border-2 text-gray-800 hover:bg-gray-50 transition-colors"
              style={{ borderColor: colors.primary }}
            >
              <Phone className="w-4 h-4" />
              Request a Call Back
            </Link>
            <Link
              href="/contact"
              className="w-full py-3 rounded-lg font-semibold text-center flex items-center justify-center gap-2 bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Connect with Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
