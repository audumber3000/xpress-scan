import type { Metadata } from 'next';
import Link from 'next/link';
import { Smartphone, Laptop, Tablet, Cloud, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import { SITE_URL, colors } from '@/lib/seo';
import { APP_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Platform - Multi-Device Dental Clinic Management Software | MolarPlus',
  description:
    'MolarPlus works on web, mobile, and tablet. Manage your dental practice from anywhere with secure, HIPAA-compliant dental clinic management software.',
  keywords:
    'dental practice management platform, mobile dental app, tablet dental software, cloud dental software, cross-platform dental management',
  alternates: { canonical: `${SITE_URL}/platform` },
  openGraph: {
    title: 'Platform - Multi-Device Dental Clinic Management | MolarPlus',
    description: 'Web, mobile, and tablet. Manage your dental practice from anywhere.',
    url: `${SITE_URL}/platform`,
  },
};

const platformJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'MolarPlus Platform',
  description: 'Multi-platform dental clinic management software with web, mobile, and tablet access. HIPAA compliant and secure.',
  provider: { '@type': 'Organization', name: 'MolarPlus', url: SITE_URL },
  serviceType: 'Dental Practice Management Platform',
};

const platforms = [
  {
    icon: Laptop,
    title: 'Web Dashboard',
    description: 'Full-featured desktop interface for comprehensive clinic management with advanced analytics and reporting.',
    features: ['Complete practice management', 'Advanced analytics dashboard', 'Multi-user support', 'Bulk operations', 'Custom reports'],
    available: 'Windows, Mac, Linux',
  },
  {
    icon: Smartphone,
    title: 'Mobile Apps',
    description: 'Native iOS and Android apps for on-the-go access to your practice from anywhere.',
    features: ['Patient management', 'Appointment scheduling', 'Real-time notifications', 'Offline access', 'Secure messaging'],
    available: 'iOS 12+, Android 8+',
  },
  {
    icon: Tablet,
    title: 'Tablet Interface',
    description: 'Optimized tablet experience perfect for chairside use and patient consultations.',
    features: ['Chairside charting', 'Patient education tools', 'Treatment planning', 'Digital signatures', 'Photo capture'],
    available: 'iPad, Android Tablets',
  },
];

const technicalFeatures = [
  { icon: Cloud, title: 'Cloud-Based Infrastructure', description: '99.9% uptime guarantee with automatic backups and disaster recovery.' },
  { icon: Shield, title: 'Enterprise Security', description: 'HIPAA compliant with end-to-end encryption and regular security audits.' },
  { icon: CheckCircle, title: 'Real-Time Sync', description: 'Instant synchronization across all devices and team members.' },
];

export default function PlatformPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(platformJsonLd) }} />
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Your Practice, Everywhere You Are</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              MolarPlus works seamlessly across all your devices. Manage your dental clinic from desktop, tablet, or
              phone with real-time synchronization.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {platforms.map((platform, index) => {
              const Icon = platform.icon;
              return (
                <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex justify-center mb-6" style={{ color: colors.primary }}>
                    <Icon className="w-16 h-16" />
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">{platform.title}</h2>
                  <p className="text-gray-600 mb-6 text-center">{platform.description}</p>
                  <ul className="space-y-3 mb-6">
                    {platform.features.map((f, i) => (
                      <li key={i} className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-center text-sm text-gray-500">Available on: {platform.available}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for Reliability and Security</h2>
            <p className="text-xl text-gray-600">Enterprise-grade infrastructure you can trust</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {technicalFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="text-center">
                  <div className="flex justify-center mb-4" style={{ color: colors.primary }}>
                    <Icon className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Seamless Integration</h2>
            <p className="text-xl text-gray-600">Connects with your existing tools and workflows</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {['Calendar Systems', 'Payment Processors', 'Insurance Providers', 'Lab Systems'].map((name, i) => (
              <div key={i} className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">🔗</span>
                </div>
                <h3 className="font-semibold text-gray-900">{name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Experience Multi-Platform Practice Management?</h2>
          <p className="text-xl text-blue-100 mb-8">Start your free trial and access MolarPlus on all your devices</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`${APP_URL}/signup`}
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
            >
              Schedule Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
