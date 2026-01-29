import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Users,
  BarChart3,
  MessageSquare,
  Shield,
  Smartphone,
  Laptop,
  Clock,
  TrendingUp,
  Heart,
} from 'lucide-react';
import { SITE_URL, colors } from '@/lib/seo';
import { APP_URL } from '@/lib/constants';
import HomeClient from '@/components/HomeClient';
import { BookDemoButton } from '@/components/BookDemoModal';

export const metadata: Metadata = {
  title: 'Best Dental Clinic Management Software | MolarPlus - Dental Practice Software',
  description:
    'MolarPlus is the best dental software and dental clinic management software for modern practices. Manage appointments, patient records, billing & analytics. Trusted dental practice management in India.',
  keywords:
    'dental clinic management software, best dental software, dental practice management, dental software India, clinic management software, dental EHR, appointment scheduling dental',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'Best Dental Clinic Management Software | MolarPlus',
    description:
      'MolarPlus is the best dental software and dental clinic management software. Manage appointments, patient records, and clinic operations.',
    url: SITE_URL,
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: 'MolarPlus Dental Software' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Dental Clinic Management Software | MolarPlus',
    description: 'MolarPlus - Best dental clinic management software for modern practices.',
  },
};

const features = [
  {
    icon: Calendar,
    title: 'Appointment Scheduling',
    description: 'Smart booking system with automated reminders and calendar integration',
  },
  {
    icon: Users,
    title: 'Patient Management',
    description: 'Complete patient records with treatment history and documents',
  },
  {
    icon: Shield,
    title: 'Secure Records',
    description: 'HIPAA-compliant data storage with end-to-end encryption',
  },
  {
    icon: BarChart3,
    title: 'Clinic Analytics',
    description: 'Real-time insights into clinic performance and revenue',
  },
  {
    icon: MessageSquare,
    title: 'Staff & Workflow',
    description: 'Team management with role-based access and task tracking',
  },
  {
    icon: Smartphone,
    title: 'Mobile Access',
    description: 'Full-featured mobile app for iOS and Android',
  },
];

const benefits = [
  { icon: Clock, title: 'Save Time on Admin', description: 'Reduce paperwork by 80% with automated workflows' },
  { icon: TrendingUp, title: 'Fewer Missed Appointments', description: 'Automated reminders reduce no-shows by 60%' },
  { icon: Heart, title: 'Better Patient Experience', description: 'Digital forms and quick check-ins improve satisfaction' },
  { icon: BarChart3, title: 'Improved Clinic Visibility', description: 'Track performance metrics and grow your practice' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section
        className="pt-32 pb-24 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 50%, #f8f9ff 100%)' }}
      >
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl"
            style={{ backgroundColor: colors.primary }}
          />
          <div
            className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl"
            style={{ backgroundColor: colors.secondary }}
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div
                className="inline-flex items-center px-6 py-3 rounded-full text-sm font-semibold mb-8 border"
                style={{
                  backgroundColor: `${colors.primary}10`,
                  color: colors.primary,
                  borderColor: `${colors.primary}20`,
                }}
              >
                <span className="mr-2">🦷</span>
                #1 dental platform for dentists
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-8 leading-tight">
                You take care of smiles.
                <br />
                <span
                  className="bg-gradient-to-r bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${colors.primary}, ${colors.secondary})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  We take care of the rest.
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                MolarPlus brings appointments, patient records, and daily clinic operations together in one simple
                platform — helping dentists spend less time on administration and more time doing what they do best:
                caring for patients.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <a
                  href={`${APP_URL}/signup`}
                  className="px-8 py-4 rounded-xl text-lg font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 text-white inline-flex items-center justify-center"
                  style={{ backgroundColor: colors.primary }}
                >
                  Get Started <ArrowRight className="ml-2 w-5 h-5" />
                </a>
                <BookDemoButton className="px-8 py-4 font-semibold text-lg border-2 border-gray-300 rounded-xl hover:border-blue-500 transition-all inline-flex items-center justify-center">
                  Book a Demo
                </BookDemoButton>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <a
                  href="#"
                  className="inline-flex items-center justify-center px-5 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors shadow-md min-w-[160px]"
                  aria-label="Download on the App Store"
                >
                  {/* Apple logo - white on black */}
                  <svg className="w-7 h-7 mr-3 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] leading-tight font-medium tracking-tight">Download on the</div>
                    <div className="text-sm font-semibold leading-tight">App Store</div>
                  </div>
                </a>
                <a
                  href="#"
                  className="inline-flex items-center justify-center px-5 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors shadow-md min-w-[160px]"
                  aria-label="GET IT ON Google Play"
                >
                  {/* Google Play - official 4-color triangle logo (cyan, red, yellow, green) */}
                  <svg className="w-7 h-7 mr-3 shrink-0" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#00C4FF" d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12 3.84 21.85C3.34 21.6 3 21.09 3 20.5z" />
                    <path fill="#FF1744" d="M6.05 2.66L16.81 8.88 14.54 11.15 6.05 2.66z" />
                    <path fill="#FFAB00" d="M20.16 10.81c.34.27.59.69.59 1.19s-.22.9-.53 1.18L17.89 14.5 15.39 12l2.5-2.5.27.31z" />
                    <path fill="#00E676" d="M16.81 15.12L6.05 21.34l8.49-8.49 2.27 2.27z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] leading-tight font-medium tracking-tight">GET IT ON</div>
                    <div className="text-sm font-semibold leading-tight">Google Play</div>
                  </div>
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="relative z-10 lg:translate-x-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/mockup-hero.png"
                  alt="MolarPlus dental clinic management software dashboard and app"
                  className="w-full h-auto lg:w-[120%] lg:max-w-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEO teaser + link to Articles */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Why Choose the Best Dental Software and Dental Clinic Management Software?
          </h2>
          <div className="prose prose-lg text-gray-600 max-w-none space-y-4">
            <p>
              Finding the <strong>best dental software</strong> for your practice can transform how you manage
              appointments, patient records, and daily operations. <strong>Dental clinic management software</strong>{' '}
              like MolarPlus gives dentists and clinic staff one unified platform for scheduling, patient
              management, billing, and analytics — so you spend less time on admin and more time with patients.
            </p>
            <p>
              MolarPlus is built to be the <strong>best dental software</strong> choice for clinics that want
              reliability, ease of use, and strong support. Our <strong>dental clinic management software</strong>{' '}
              covers appointments, patient files, payments, and analytics in a single platform. Explore our{' '}
              <Link href="/features" className="text-blue-600 hover:underline">features</Link> and{' '}
              <Link href="/pricing" className="text-blue-600 hover:underline">pricing</Link>, or{' '}
              <Link href="/contact" className="text-blue-600 hover:underline">contact us</Link> for a demo.
            </p>
            <p className="pt-4">
              <Link
                href="/articles"
                className="inline-flex items-center font-semibold text-blue-600 hover:underline"
              >
                Read more articles on dental software and clinic management <ArrowRight className="ml-1 w-4 h-4" />
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Platform Overview */}
      <section id="platform" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Complete Platform Solution</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              MolarPlus works seamlessly across all your devices. Manage your clinic from anywhere, anytime.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: `${colors.primary}10` }}
              >
                <Laptop className="w-10 h-10" style={{ color: colors.primary }} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Web Dashboard</h3>
              <p className="text-gray-600">
                Full-featured desktop interface for comprehensive clinic management
              </p>
            </div>
            <div className="text-center p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: `${colors.secondary}10` }}
              >
                <Smartphone className="w-10 h-10" style={{ color: colors.secondary }} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Mobile Apps</h3>
              <p className="text-gray-600">Native iOS and Android apps for on-the-go access</p>
            </div>
            <div className="text-center p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: `${colors.accent}10` }}
              >
                <Shield className="w-10 h-10" style={{ color: colors.accent }} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Secure Sync</h3>
              <p className="text-gray-600">Real-time synchronization across all your devices</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Powerful Features</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to run your dental practice efficiently
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1 border border-gray-100"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${colors.primary}10` }}
                >
                  <Icon className="w-8 h-8" style={{ color: colors.primary }} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mobile App Gallery - Client component for slider */}
      <HomeClient />

      {/* Benefits Section */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Benefits for Dentists</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Focus on what matters most — your patients</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => {
              const BenefitIcon = benefit.icon;
              return (
              <div key={index} className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ backgroundColor: `${colors.primary}10` }}
                >
                  <BenefitIcon className="w-6 h-6" style={{ color: colors.primary }} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="contact"
        className="py-24 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)` }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white" />
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-white" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Ready to Transform Your Practice?</h2>
          <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto">
            Join hundreds of dental practices already using MolarPlus to streamline their operations and improve
            patient care.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a
              href={`${APP_URL}/signup`}
              className="px-10 py-4 rounded-xl text-lg font-semibold bg-white text-blue-600 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 inline-flex items-center justify-center"
            >
              Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
            </a>
            <BookDemoButton className="px-10 py-4 rounded-xl text-lg font-semibold text-white border-2 border-white hover:bg-white hover:text-blue-600 transition-all inline-flex items-center justify-center w-full sm:w-auto">
              Schedule Demo
            </BookDemoButton>
          </div>
        </div>
      </section>
    </div>
  );
}
