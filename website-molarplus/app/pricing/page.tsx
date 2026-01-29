import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, ArrowRight, X } from 'lucide-react';
import { SITE_URL, colors } from '@/lib/seo';
import { APP_URL } from '@/lib/constants';
import PricingPlans from '@/components/PricingPlans';

export const metadata: Metadata = {
  title: 'Pricing - Free, Pro & Enterprise Dental Clinic Software | MolarPlus',
  description:
    'MolarPlus pricing: Free plan for 1 chair, Pro from ₹1299/month in India or $20/month elsewhere with full admin & WhatsApp. Enterprise with offline support. Country-based pricing.',
  keywords:
    'dental software pricing, dental clinic management cost, free dental software, dental practice plans India, clinic software pricing INR USD',
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: 'Pricing - Free, Pro & Enterprise | MolarPlus Dental Software',
    description: 'Free for 1 chair. Pro from ₹1299/mo (India) or $20/mo. Enterprise with offline support. See plans.',
    url: `${SITE_URL}/pricing`,
  },
};

type CompareCell = boolean | string;
const comparisonRows: { feature: string; free: CompareCell; pro: CompareCell; enterprise: CompareCell }[] = [
  { feature: 'Chairs / scale', free: '1 chair', pro: '2–5 chairs', enterprise: 'Larger clinics' },
  { feature: 'Employees', free: 'Up to 2', pro: 'More', enterprise: 'Unlimited' },
  { feature: 'Core clinic features', free: true, pro: true, enterprise: true },
  { feature: 'Mobile, web & desktop apps', free: true, pro: true, enterprise: true },
  { feature: 'Admin controls', free: false, pro: true, enterprise: true },
  { feature: 'Staff attendance', free: false, pro: true, enterprise: true },
  { feature: 'Device management', free: false, pro: true, enterprise: true },
  { feature: 'Clinic finance & reports', free: false, pro: true, enterprise: true },
  { feature: 'WhatsApp, email, bulk notifications', free: false, pro: true, enterprise: true },
  { feature: 'Offline support & assisted installation', free: false, pro: false, enterprise: true },
];

function Cell({ value }: { value: CompareCell }) {
  if (typeof value === 'boolean') {
    return value ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-gray-300 mx-auto" />;
  }
  return <span className="text-gray-600 text-sm">{value}</span>;
}

const pricingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'MolarPlus Dental Clinic Management Software',
  description: 'Pricing plans: Free (1 chair), Pro (2–5 chairs, ₹1299/mo India or $20/mo), Enterprise (custom).',
  brand: { '@type': 'Brand', name: 'MolarPlus' },
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR', description: '1 chair, up to 2 employees, core features' },
    { '@type': 'Offer', name: 'Pro', price: '1299', priceCurrency: 'INR', priceValidUntil: '2026-12-31', description: 'India: ₹1299/month. Other: $20/month. Yearly 25% off.' },
    { '@type': 'Offer', name: 'Pro USD', price: '20', priceCurrency: 'USD', priceValidUntil: '2026-12-31' },
    { '@type': 'Offer', name: 'Enterprise', description: 'Custom pricing. Offline support and assisted installation.' },
  ],
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }} />

      {/* Hero + plans */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing for Dental Clinics
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
              Start free with one chair, or upgrade to Pro for full admin and communication. Enterprise gets offline support and assisted installation.
            </p>
            <p className="text-sm text-gray-500">
              Pricing in <strong>India (INR)</strong> and <strong>other countries (USD)</strong>. Use the selector above to switch.
            </p>
          </div>
          <PricingPlans />
        </div>
      </section>

      {/* Crawlable plan descriptions for SEO */}
      <section className="py-16 bg-white" aria-labelledby="plan-details-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="plan-details-heading" className="text-2xl font-bold text-gray-900 mb-8 text-center">
            What Each MolarPlus Plan Includes
          </h2>
          <div className="space-y-10 text-gray-700">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Free plan</h3>
              <p>
                The <strong>Free</strong> plan supports one chair and up to two employees. It includes core clinic features such as appointments and patient records, plus access to MolarPlus on mobile, web, and desktop. It does not include admin controls or communication tools like WhatsApp, email, or bulk notifications. The Free plan remains free with no pricing — ideal for getting started. <Link href={`${APP_URL}/signup`} className="text-blue-600 hover:underline font-medium">Sign up for free</Link>.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Pro plan</h3>
              <p>
                The <strong>Pro</strong> plan is suitable for clinics with 2–5 chairs. It includes everything in Free plus full admin features: staff attendance, employee device management, clinic finance and reports, and a complete communication suite including bulk WhatsApp, email, and notifications. Pricing is country-based: <strong>₹1299 per month in India</strong> and <strong>$20 per month for all other countries</strong>. You can bill yearly at a 25% discount. <Link href={`${APP_URL}/signup`} className="text-blue-600 hover:underline font-medium">Start a free trial</Link> or compare <Link href="/features" className="text-blue-600 hover:underline font-medium">features</Link>.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Enterprise plan</h3>
              <p>
                The <strong>Enterprise</strong> plan is for larger clinics and includes everything in Pro plus offline software support and assisted installation. Pricing is custom — <Link href="/contact" className="text-blue-600 hover:underline font-medium">request a call back</Link> or <Link href="/contact" className="text-blue-600 hover:underline font-medium">connect with us</Link> for a quote.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16 bg-gray-50" aria-labelledby="compare-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="compare-heading" className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Compare Plans
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] bg-white rounded-xl shadow-sm border border-gray-200">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-4 font-semibold text-gray-900">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900">Free</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900">Pro</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-4 px-4 font-medium text-gray-800">{row.feature}</td>
                    <td className="text-center py-4 px-4"><Cell value={row.free} /></td>
                    <td className="text-center py-4 px-4"><Cell value={row.pro} /></td>
                    <td className="text-center py-4 px-4"><Cell value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Internal links + CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Explore More</h2>
          <p className="text-gray-600 mb-8">
            See our <Link href="/features" className="text-blue-600 hover:underline font-medium">features</Link>,{' '}
            <Link href="/contact" className="text-blue-600 hover:underline font-medium">contact us</Link> for Enterprise or demos, or get started now.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`${APP_URL}/signup`}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-800 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
