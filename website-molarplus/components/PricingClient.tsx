'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { APP_URL } from '@/lib/constants';

type Plan = {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  excluded: string[];
  popular: boolean;
};

type Props = {
  plans: Plan[];
  colors: { primary: string };
};

export default function PricingClient({ plans, colors }: Props) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const getDisplayPrice = (plan: Plan) => (billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice);
  const getBillingText = () => (billingCycle === 'monthly' ? '/month' : '/year (Save 17%)');

  return (
    <div className="mb-12">
      <div className="flex items-center justify-center gap-4 mb-12">
        <span className={`text-lg ${billingCycle === 'monthly' ? 'font-semibold' : 'text-gray-500'}`}>Monthly</span>
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
        <span className={`text-lg ${billingCycle === 'yearly' ? 'font-semibold' : 'text-gray-500'}`}>
          Yearly <span className="text-green-600 text-sm">(Save 17%)</span>
        </span>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan, index) => (
          <div
            key={index}
            className={`bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all ${
              plan.popular ? 'ring-2 ring-blue-600 transform scale-105' : ''
            }`}
          >
            {plan.popular && (
              <div className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full text-center mb-4">
                Most Popular
              </div>
            )}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>
              <p className="text-gray-600 mb-4">{plan.description}</p>
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold" style={{ color: colors.primary }}>
                  ₹{getDisplayPrice(plan)}
                </span>
                <span className="text-gray-500 ml-2">{getBillingText()}</span>
              </div>
            </div>
            <ul className="space-y-4 mb-8">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{f}</span>
                </li>
              ))}
              {plan.excluded.map((f, i) => (
                <li key={i} className="flex items-start opacity-50">
                  <div className="w-5 h-5 border-2 border-gray-300 rounded-full mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-500">{f}</span>
                </li>
              ))}
            </ul>
            <a
              href={`${APP_URL}/signup`}
              className={`w-full py-3 rounded-lg font-semibold text-center block transition-colors ${
                plan.popular ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              Start Free Trial
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
