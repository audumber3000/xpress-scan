import React from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Laptop, Tablet, Cloud, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';

const Platform = () => {
  const colors = {
    primary: '#2a276e',
    secondary: '#4a4694',
    dark: '#1a1548',
    light: '#f8f9fa',
    accent: '#6366f1'
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "MolarPlus Platform",
    "description": "Multi-platform dental practice management solution with web, mobile, and tablet access. HIPAA compliant and secure.",
    "provider": {
      "@type": "Organization",
      "name": "MolarPlus",
      "url": "https://molarplus.app"
    },
    "serviceType": "Dental Practice Management Platform"
  };

  const platforms = [
    {
      icon: <Laptop className="w-16 h-16" />,
      title: "Web Dashboard",
      description: "Full-featured desktop interface for comprehensive clinic management with advanced analytics and reporting.",
      features: [
        "Complete practice management",
        "Advanced analytics dashboard",
        "Multi-user support",
        "Bulk operations",
        "Custom reports"
      ],
      available: "Windows, Mac, Linux"
    },
    {
      icon: <Smartphone className="w-16 h-16" />,
      title: "Mobile Apps",
      description: "Native iOS and Android apps for on-the-go access to your practice from anywhere.",
      features: [
        "Patient management",
        "Appointment scheduling",
        "Real-time notifications",
        "Offline access",
        "Secure messaging"
      ],
      available: "iOS 12+, Android 8+"
    },
    {
      icon: <Tablet className="w-16 h-16" />,
      title: "Tablet Interface",
      description: "Optimized tablet experience perfect for chairside use and patient consultations.",
      features: [
        "Chairside charting",
        "Patient education tools",
        "Treatment planning",
        "Digital signatures",
        "Photo capture"
      ],
      available: "iPad, Android Tablets"
    }
  ];

  const technicalFeatures = [
    {
      icon: <Cloud className="w-12 h-12" />,
      title: "Cloud-Based Infrastructure",
      description: "99.9% uptime guarantee with automatic backups and disaster recovery."
    },
    {
      icon: <Shield className="w-12 h-12" />,
      title: "Enterprise Security",
      description: "HIPAA compliant with end-to-end encryption and regular security audits."
    },
    {
      icon: <CheckCircle className="w-12 h-12" />,
      title: "Real-Time Sync",
      description: "Instant synchronization across all devices and team members."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="Platform - Multi-Device Dental Practice Management | MolarPlus"
        description="MolarPlus works seamlessly across web, mobile, and tablet devices. Manage your dental practice from anywhere with our secure, HIPAA-compliant platform."
        keywords="dental practice management platform, mobile dental app, tablet dental software, cloud dental software, cross-platform dental management"
        url="https://molarplus.app/platform"
        structuredData={structuredData}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Your Practice, Everywhere You Are
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              MolarPlus works seamlessly across all your devices. Manage your clinic from desktop, tablet, or phone with real-time synchronization.
            </p>
          </div>
        </div>
      </section>

      {/* Platform Cards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {platforms.map((platform, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex justify-center mb-6" style={{ color: colors.primary }}>
                  {platform.icon}
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4 text-center">
                  {platform.title}
                </h3>
                <p className="text-gray-600 mb-6 text-center">
                  {platform.description}
                </p>
                <div className="space-y-3 mb-6">
                  {platform.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-500">Available on: {platform.available}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Built for Reliability and Security
            </h2>
            <p className="text-xl text-gray-600">
              Enterprise-grade infrastructure you can trust
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {technicalFeatures.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4" style={{ color: colors.primary }}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Seamless Integration
            </h2>
            <p className="text-xl text-gray-600">
              Connects with your existing tools and workflows
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              "Calendar Systems", "Payment Processors", "Insurance Providers", "Lab Systems"
            ].map((integration, index) => (
              <div key={index} className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">🔗</span>
                </div>
                <h3 className="font-semibold text-gray-900">{integration}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Experience Multi-Platform Practice Management?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Start your free trial and access MolarPlus on all your devices
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/signup" 
              className="inline-flex items-center justify-center space-x-2 bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/contact" 
              className="inline-flex items-center justify-center space-x-2 border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-blue-600 transition-colors font-semibold"
            >
              <span>Schedule Demo</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Platform;
