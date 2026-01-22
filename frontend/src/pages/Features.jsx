import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  FileText, 
  DollarSign, 
  MessageSquare, 
  Mic,
  BarChart3,
  Shield,
  Clock,
  Zap,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import SEO from '../components/SEO';
import betterClinicLogo from '../assets/betterclinic-logo.png';

const colors = {
  primary: '#2a276e',
  secondary: '#4a4694',
  dark: '#1a1548',
  light: '#f8f9fa',
  accent: '#6366f1'
};

const Features = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "MolarPlus Dental Practice Management Software",
    "description": "Comprehensive dental practice management software with patient management, appointments, mobile apps, analytics, and more",
    "brand": {
      "@type": "Brand",
      "name": "MolarPlus"
    },
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "1500",
      "highPrice": "15000",
      "priceCurrency": "INR"
    }
  };

  const features = [
    {
      icon: <Users className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "Patient Management System",
      description: "Comprehensive dental patient management with digital records, treatment history, and profile management. Store all patient information securely in one centralized system.",
      benefits: [
        "Complete patient profiles with dental history",
        "Digital patient records management",
        "Quick patient search and filtering",
        "Patient demographics and contact info",
        "Treatment history and notes"
      ]
    },
    {
      icon: <Calendar className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "Dental Appointment Scheduling",
      description: "Smart appointment scheduling system designed for dental practices. Book, reschedule, and track appointments with automated reminders.",
      benefits: [
        "Visual calendar interface",
        "Automated appointment reminders",
        "Online booking integration",
        "Waitlist management",
        "Recurring appointment support"
      ]
    },
    {
      icon: <MessageSquare className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "Patient Communication",
      description: "Send automated notifications for appointments, treatment reminders, and important updates directly to your patients' phones.",
      benefits: [
        "Appointment reminders via SMS",
        "Treatment follow-ups",
        "Bulk messaging capabilities",
        "Two-way communication",
        "Template message support"
      ]
    },
    {
      icon: <DollarSign className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "Dental Billing & Payments",
      description: "Complete billing solution for dental practices with invoice generation, payment tracking, and insurance claims management.",
      benefits: [
        "Digital invoice generation",
        "Payment tracking and receipts",
        "Multiple payment methods",
        "Insurance claims processing",
        "Treatment cost estimates"
      ]
    },
    {
      icon: <BarChart3 className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "Dental Practice Analytics",
      description: "Powerful analytics dashboard with insights into patient flow, revenue trends, appointment patterns, and dental practice performance.",
      benefits: [
        "Real-time dashboard",
        "Revenue analytics and trends",
        "Patient flow analysis",
        "Custom report generation",
        "Performance metrics tracking"
      ]
    },
    {
      icon: <FileText className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "Treatment Planning & Charts",
      description: "Manage dental treatments, prescriptions, and follow-ups efficiently. Create comprehensive treatment plans and track patient progress.",
      benefits: [
        "Digital treatment planning",
        "Dental charting tools",
        "Prescription management",
        "Follow-up scheduling",
        "Clinical notes and observations"
      ]
    },
    {
      icon: <Shield className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "HIPAA Security & Compliance",
      description: "Enterprise-grade security with encrypted data storage, role-based access control, and HIPAA compliance for dental practices.",
      benefits: [
        "HIPAA compliant infrastructure",
        "Encrypted data storage",
        "Role-based access control",
        "Audit logs and tracking",
        "Regular security updates"
      ]
    },
    {
      icon: <Clock className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "Staff Management",
      description: "Manage your dental practice staff, assign roles, track performance, and maintain team schedules all in one place.",
      benefits: [
        "Staff profiles and roles",
        "Performance tracking",
        "Schedule management",
        "Task assignment",
        "Access control"
      ]
    },
    {
      icon: <Zap className="w-12 h-12" style={{ color: colors.primary }} />,
      title: "Quick & Easy Setup",
      description: "Get started in under 24 hours with our simple onboarding process. No technical knowledge required - we handle everything for you.",
      benefits: [
        "24-hour setup time",
        "Free onboarding support",
        "Staff training included",
        "Data migration assistance",
        "Dedicated account manager"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Features - MolarPlus Dental Practice Management Software | Complete Dental Solution"
        description="Explore MolarPlus comprehensive features: patient management, appointment scheduling, mobile apps, payment processing, analytics & more. Best dental practice management software for dentists."
        keywords="dental software features, practice management, appointment scheduling, patient records, dental analytics, mobile dental app, HIPAA compliance, dental billing"
        url="https://molarplus.app/features"
        structuredData={structuredData}
      />

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center overflow-hidden" style={{ height: '50px' }}>
                <img 
                  src={betterClinicLogo} 
                  alt="Better Clinic Logo" 
                  className="h-22 w-auto"
                />
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              <Link to="/" className="text-gray-600 hover:text-[#2a276e] transition-colors">
                Home
              </Link>
              <Link to="/about" className="text-gray-600 hover:text-[#2a276e] transition-colors">
                About
              </Link>
              <Link 
                to="/signup" 
                className="bg-[#2a276e] text-white px-6 py-2 rounded-lg hover:bg-[#1a1548] transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-[#9B8CFF]/10 via-blue-50 to-[#9B8CFF]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Powerful Features for <span className="text-[#2a276e]">Better Clinic Management</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Everything you need to run your clinic efficiently - all in one comprehensive platform
            </p>
            <Link 
              to="/signup" 
              className="inline-flex items-center space-x-2 bg-[#2a276e] text-white px-8 py-4 rounded-lg hover:bg-[#1a1548] transition-colors text-lg font-medium"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="mb-6">
                    {feature.icon}
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    {feature.title}
                  </h2>
                  <p className="text-lg text-gray-600 mb-6">
                    {feature.description}
                  </p>
                  <div className="space-y-3">
                    {feature.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-[#2a276e] flex-shrink-0 mt-1" />
                        <span className="text-gray-700">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`bg-gradient-to-br from-[#9B8CFF]/10 to-blue-50 rounded-2xl p-12 ${
                  index % 2 === 1 ? 'lg:order-1' : ''
                }`}>
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      {feature.icon}
                      <p className="text-gray-500 mt-4">Feature Preview</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Healthcare Professionals Love Clino Health
            </h2>
            <p className="text-xl text-gray-600">
              The complete clinic management software solution built for Indian healthcare
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="text-4xl font-bold text-[#2a276e] mb-2">70%</div>
              <p className="text-gray-600">Reduction in administrative time</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="text-4xl font-bold text-[#9B8CFF] mb-2">3x</div>
              <p className="text-gray-600">Faster patient check-ins</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">95%</div>
              <p className="text-gray-600">Patient satisfaction rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-[#2a276e] to-[#1a1548]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Experience Better Clinic Management?
          </h2>
          <p className="text-xl text-white mb-8">
            Join hundreds of healthcare professionals using Clino Health to streamline their practice
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/signup" 
              className="inline-flex items-center justify-center space-x-2 bg-white text-[#2a276e] px-8 py-4 rounded-lg hover:bg-gray-50 transition-colors text-lg font-medium"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/#contact" 
              className="inline-flex items-center justify-center space-x-2 border-2 border-white text-white px-8 py-4 rounded-lg hover:bg-white hover:text-[#2a276e] transition-colors text-lg font-medium"
            >
              <span>Contact Sales</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2024 Better Clinic. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Features;




