import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Privacy Policy - MolarPlus Dental Clinic Management Software',
  description:
    'MolarPlus Privacy Policy. How we collect, use, disclose, and safeguard your information when you use our dental clinic management software.',
  keywords: 'MolarPlus privacy policy, dental software privacy, clinic management data protection',
  alternates: { canonical: `${SITE_URL}/privacy-policy` },
  openGraph: {
    title: 'Privacy Policy - MolarPlus',
    description: 'How we protect your data when you use MolarPlus dental clinic management software.',
    url: `${SITE_URL}/privacy-policy`,
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      <section className="pt-12 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: January 2025</p>

          <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p>
                MolarPlus (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your
                privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you use our dental clinic management software and related services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Data Collection</h2>
              <p>
                MolarPlus dental clinic management software stores patient and clinic data in accordance with your
                configuration. We do not collect, transmit, or store your patient data on our servers unless you
                explicitly opt-in to cloud backup or sync services.
              </p>
              <p className="mt-4">We may collect the following information:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Account and license information for software activation</li>
                <li>Anonymous usage statistics (with your consent)</li>
                <li>Support requests and communication</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Data Storage</h2>
              <p>
                Patient data, dental records, and clinic information are stored in accordance with your chosen
                deployment. Your data is not shared with third parties unless you explicitly authorize it or as
                required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your data.
                However, you are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Maintaining secure backups of your data</li>
                <li>Using strong passwords for your system</li>
                <li>Keeping your software updated</li>
                <li>Following HIPAA and local data protection regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Third-Party Services</h2>
              <p>MolarPlus may use third-party services for:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Payment processing (Razorpay, Stripe)</li>
                <li>Email and SMS notifications (if enabled)</li>
                <li>Software updates and hosting</li>
              </ul>
              <p className="mt-4">These services have their own privacy policies, and we encourage you to review them.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Access your data</li>
                <li>Export your data at any time</li>
                <li>Request deletion of your data from our systems</li>
                <li>Opt-out of anonymous usage statistics</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Children&apos;s Privacy</h2>
              <p>
                Our software is not intended for use by individuals under the age of 18. We do not knowingly collect
                personal information from children.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Changes to This Policy</h2>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the
                new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us at:</p>
              <p className="mt-2">
                <strong>Email:</strong> privacy@molarplus.com
                <br />
                <strong>Phone:</strong> +91 8766742410
                <br />
                <strong>Address:</strong> Pune, Maharashtra, India
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
