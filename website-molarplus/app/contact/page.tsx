import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, MapPin, Send, Clock } from 'lucide-react';
import { SITE_URL, colors } from '@/lib/seo';
import { APP_URL } from '@/lib/constants';
import ContactForm from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us - Dental Clinic Management Software | MolarPlus',
  description:
    'Contact MolarPlus for dental software demos, support, and sales. Reach us via phone, email, or visit. Get a demo of the best dental clinic management software.',
  keywords:
    'contact MolarPlus, dental software support, dental software demo, practice management help, dental software sales',
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: 'Contact Us - MolarPlus Dental Clinic Management Software',
    description: 'Get in touch for demos, support, and sales. We are here to help your dental practice.',
    url: `${SITE_URL}/contact`,
  },
};

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact MolarPlus',
  description: 'Get in touch with MolarPlus for dental clinic management software demos, support, and inquiries.',
  url: `${SITE_URL}/contact`,
  mainEntity: {
    '@type': 'Organization',
    name: 'MolarPlus',
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Dental Tower, MG Road',
      addressLocality: 'Bangalore',
      addressRegion: 'Karnataka',
      postalCode: '560001',
      addressCountry: 'IN',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-8766742410',
      contactType: 'Customer Service',
      email: 'support@molarplus.com',
      availableLanguage: ['English', 'Hindi'],
    },
  },
};

const contactInfo = [
  { icon: Phone, title: 'Phone', details: ['+91-8766742410', 'Mon-Fri: 9AM-6PM IST'], action: 'tel:+918766742410' },
  { icon: Mail, title: 'Email', details: ['support@molarplus.com', 'sales@molarplus.com'], action: 'mailto:support@molarplus.com' },
  { icon: MapPin, title: 'Office', details: ['123 Dental Tower, MG Road', 'Bangalore, Karnataka 560001'], action: '#' },
];

const offices = [
  { city: 'Bangalore', address: '123 Dental Tower, MG Road, Bangalore, Karnataka 560001', phone: '+91-8766742410', email: 'bangalore@molarplus.com' },
  { city: 'Mumbai', address: '456 Dental Plaza, Andheri West, Mumbai, Maharashtra 400053', phone: '+91-8766742411', email: 'mumbai@molarplus.com' },
  { city: 'Delhi', address: '789 Dental Center, Connaught Place, New Delhi 110001', phone: '+91-8766742412', email: 'delhi@molarplus.com' },
];

const faqs = [
  { q: 'How quickly can I get started with MolarPlus?', a: 'You can start immediately with our free trial. Full setup typically takes 24-48 hours, including data migration and staff training.' },
  { q: 'Is MolarPlus HIPAA compliant?', a: 'Yes, MolarPlus is fully HIPAA compliant with end-to-end encryption, secure data storage, and regular security audits.' },
  { q: 'Can I import my existing patient data?', a: 'Yes, we provide free data migration services to import your existing patient records, appointments, and treatment history.' },
  { q: 'What kind of support do you offer?', a: 'We offer email, phone, and chat support. Professional and Enterprise plans include priority support with faster response times.' },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Get in Touch</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Have questions about MolarPlus? Want to see a demo? Our team is here to help you transform your
              dental practice with the best dental clinic management software.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {contactInfo.map((info, index) => {
              const Icon = info.icon;
              return (
                <div key={index} className="bg-white rounded-2xl p-8 shadow-lg text-center">
                  <div className="flex justify-center mb-4" style={{ color: colors.primary }}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">{info.title}</h2>
                  {info.details.map((d, i) => (
                    <p key={i} className="text-gray-600 mb-2">{d}</p>
                  ))}
                  <a href={info.action} className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium">
                    {info.title === 'Phone' ? 'Call Now' : info.title === 'Email' ? 'Send Email' : 'Get Directions'}
                  </a>
                </div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
              <ContactForm colors={colors} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Offices</h2>
              <div className="space-y-6">
                {offices.map((office, index) => (
                  <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{office.city}</h3>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600">{office.address}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600">{office.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600">{office.email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 rounded-xl p-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Support Hours</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">Monday - Friday: 9:00 AM - 6:00 PM IST</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">Saturday: 10:00 AM - 2:00 PM IST</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">Sunday: Closed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Practice?</h2>
          <p className="text-xl text-blue-100 mb-8">Schedule a personalized demo with our team</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`${APP_URL}/signup`}
              className="inline-flex items-center justify-center bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Start Free Trial
            </a>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
