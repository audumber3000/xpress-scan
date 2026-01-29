import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Heart, Target, Award } from 'lucide-react';
import { SITE_URL, colors } from '@/lib/seo';
import { APP_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About MolarPlus - Best Dental Clinic Management Software Company',
  description:
    'Learn about MolarPlus, the dental clinic management software trusted by dental practices across India. Our mission: simplify clinic operations with the best dental software.',
  keywords:
    'about MolarPlus, dental software company, clinic management software India, dental practice management, healthcare technology India',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'About MolarPlus - Dental Clinic Management Software',
    description: 'Making dental practice management simple, efficient, and accessible for dentists across India.',
    url: `${SITE_URL}/about`,
  },
};

const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About MolarPlus',
  description: 'MolarPlus is the best dental clinic management software for modern dental practices in India.',
  publisher: { '@type': 'Organization', name: 'MolarPlus', url: SITE_URL },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }} />
      <section className="pt-12 pb-16 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              About <span style={{ color: colors.primary }}>MolarPlus</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Making dental practice management simple, efficient, and accessible for dentists across India
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Our Mission</h2>
              <p className="text-lg text-gray-600 mb-6">
                At MolarPlus, we are on a mission to transform dental practice management in India by providing
                the <strong>best dental software</strong> and <strong>dental clinic management software</strong> that
                simplifies daily operations for dentists and clinic staff.
              </p>
              <p className="text-lg text-gray-600 mb-6">
                We understand the challenges dental professionals face — from managing patient records and
                appointments to handling payments and communications. That is why we built a comprehensive
                <strong> dental clinic management software</strong> that addresses every aspect of practice
                management.
              </p>
              <p className="text-lg text-gray-600">
                Our platform combines modern technology with intuitive design, so dentists can focus on what
                matters most: providing excellent patient care.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold mb-2" style={{ color: colors.primary }}>250+</div>
                <div className="text-gray-600">Clinics Trust Us</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold mb-2" style={{ color: colors.secondary }}>10K+</div>
                <div className="text-gray-600">Patients Managed</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">50K+</div>
                <div className="text-gray-600">Appointments Scheduled</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-orange-600 mb-2">99.9%</div>
                <div className="text-gray-600">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Values</h2>
            <p className="text-xl text-gray-600">The principles that guide everything we do</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <Heart className="w-12 h-12 mb-4" style={{ color: colors.primary }} />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Patient-Centric</h3>
              <p className="text-gray-600">
                We empower dental providers to deliver exceptional patient care through better clinic management
                tools and efficient workflows.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <Target className="w-12 h-12 mb-4" style={{ color: colors.primary }} />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Simplicity First</h3>
              <p className="text-gray-600">
                We design our dental clinic management software to be intuitive so dentists can focus on patients,
                not technology.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <Award className="w-12 h-12 mb-4" style={{ color: colors.primary }} />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Innovation</h3>
              <p className="text-gray-600">
                We continuously innovate with features like WhatsApp integration, analytics, and mobile apps to
                stay ahead in dental practice software.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Dentists Choose MolarPlus</h2>
            <p className="text-xl text-gray-600">The best dental software trusted by practices across India</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { title: 'Complete Dental Clinic Management', desc: 'Everything you need — patient management to revenue tracking' },
              { title: 'Built for Indian Dental Practices', desc: 'Designed for Indian clinics with local payment methods and WhatsApp' },
              { title: '24/7 Support in Hindi & English', desc: 'Get help whenever you need it in your preferred language' },
              { title: 'Secure & HIPAA Compliant', desc: 'Enterprise-grade security to protect patient data' },
              { title: 'Affordable Pricing', desc: 'Starting at ₹1,499/month — best value dental software in India' },
              { title: 'Quick Setup & Training', desc: 'Get started in 24 hours with free onboarding and staff training' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: colors.primary }} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 text-white" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%)` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Transform Your Practice?</h2>
          <p className="text-xl text-white/90 mb-8">
            Join 250+ dental practices using MolarPlus — the best dental clinic management software
          </p>
          <a
            href={`${APP_URL}/signup`}
            className="inline-flex items-center gap-2 bg-white px-8 py-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            style={{ color: colors.primary }}
          >
            Start Your Free Trial <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>
    </div>
  );
}
