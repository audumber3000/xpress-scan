import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, Clock, Users, Shield } from 'lucide-react';
import SEO from '../components/SEO';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    practice: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  const colors = {
    primary: '#2a276e',
    secondary: '#4a4694',
    dark: '#1a1548',
    light: '#f8f9fa',
    accent: '#6366f1'
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Contact MolarPlus",
    "description": "Get in touch with MolarPlus team for dental practice management software demos, support, and inquiries.",
    "url": "https://molarplus.app/contact",
    "provider": {
      "@type": "Organization",
      "name": "MolarPlus",
      "url": "https://molarplus.app",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "123 Dental Tower, MG Road",
        "addressLocality": "Bangalore",
        "addressRegion": "Karnataka",
        "postalCode": "560001",
        "addressCountry": "IN"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+91-8766742410",
        "contactType": "Customer Service",
        "email": "support@molarplus.app",
        "availableLanguage": ["English", "Hindi"]
      }
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    setTimeout(() => {
      setSubmitStatus('Thank you for your message! We\'ll get back to you within 24 hours.');
      setFormData({ name: '', email: '', phone: '', practice: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  const contactInfo = [
    {
      icon: <Phone className="w-6 h-6" />,
      title: "Phone",
      details: ["+91-8766742410", "Mon-Fri: 9AM-6PM IST"],
      action: "tel:+918766742410"
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: "Email", 
      details: ["support@molarplus.app", "sales@molarplus.app"],
      action: "mailto:support@molarplus.app"
    },
    {
      icon: <MapPin className="w-6 h-6" />,
      title: "Office",
      details: ["123 Dental Tower, MG Road", "Bangalore, Karnataka 560001"],
      action: "#"
    }
  ];

  const officeLocations = [
    {
      city: "Bangalore",
      address: "123 Dental Tower, MG Road, Bangalore, Karnataka 560001",
      phone: "+91-8766742410",
      email: "bangalore@molarplus.app"
    },
    {
      city: "Mumbai", 
      address: "456 Dental Plaza, Andheri West, Mumbai, Maharashtra 400053",
      phone: "+91-8766742411",
      email: "mumbai@molarplus.app"
    },
    {
      city: "Delhi",
      address: "789 Dental Center, Connaught Place, New Delhi 110001",
      phone: "+91-8766742412", 
      email: "delhi@molarplus.app"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="Contact Us - Dental Practice Management Software | MolarPlus"
        description="Contact MolarPlus for dental practice management software demos, support, and sales. Reach us via phone, email, or visit our offices in Bangalore, Mumbai, and Delhi."
        keywords="contact dental software, MolarPlus support, dental software demo, practice management help, dental software sales"
        url="https://molarplus.app/contact"
        structuredData={structuredData}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Get in Touch
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Have questions about MolarPlus? Want to see a demo? Our team is here to help you transform your dental practice.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {contactInfo.map((info, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg text-center">
                <div className="flex justify-center mb-4" style={{ color: colors.primary }}>
                  {info.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{info.title}</h3>
                {info.details.map((detail, detailIndex) => (
                  <p key={detailIndex} className="text-gray-600 mb-2">{detail}</p>
                ))}
                <a 
                  href={info.action}
                  className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  {info.title === "Phone" ? "Call Now" : info.title === "Email" ? "Send Email" : "Get Directions"}
                </a>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
              <form onSubmit={handleSubmit}>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Dr. John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="john@dentclinic.com"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+91-9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Practice Name
                    </label>
                    <input
                      type="text"
                      name="practice"
                      value={formData.practice}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Smile Dental Clinic"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell us about your practice and how we can help..."
                  />
                </div>

                {submitStatus && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                    {submitStatus}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center"
                  style={{ backgroundColor: colors.primary }}
                >
                  {isSubmitting ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Office Locations */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Offices</h2>
              <div className="space-y-6">
                {officeLocations.map((office, index) => (
                  <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{office.city}</h3>
                    <div className="space-y-2">
                      <div className="flex items-start">
                        <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600">{office.address}</span>
                      </div>
                      <div className="flex items-center">
                        <Phone className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                        <span className="text-gray-600">{office.phone}</span>
                      </div>
                      <div className="flex items-center">
                        <Mail className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                        <span className="text-gray-600">{office.email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Support Hours */}
              <div className="bg-blue-50 rounded-xl p-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Support Hours</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-gray-700">Monday - Friday: 9:00 AM - 6:00 PM IST</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-gray-700">Saturday: 10:00 AM - 2:00 PM IST</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-gray-700">Sunday: Closed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-6">
            {[
              {
                question: "How quickly can I get started with MolarPlus?",
                answer: "You can start immediately with our free trial. Full setup typically takes 24-48 hours, including data migration and staff training."
              },
              {
                question: "Is MolarPlus HIPAA compliant?",
                answer: "Yes, MolarPlus is fully HIPAA compliant with end-to-end encryption, secure data storage, and regular security audits."
              },
              {
                question: "Can I import my existing patient data?",
                answer: "Yes, we provide free data migration services to import your existing patient records, appointments, and treatment history."
              },
              {
                question: "What kind of support do you offer?",
                answer: "We offer email, phone, and chat support. Professional and Enterprise plans include priority support with faster response times."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Schedule a personalized demo with our team
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/signup" 
              className="inline-flex items-center justify-center space-x-2 bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              <span>Start Free Trial</span>
            </Link>
            <Link 
              to="/pricing" 
              className="inline-flex items-center justify-center space-x-2 border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-blue-600 transition-colors font-semibold"
            >
              <span>View Pricing</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
