import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  Shield, 
  Calendar, 
  FileText, 
  DollarSign, 
  Brain, 
  Database,
  CheckCircle,
  Star,
  Menu,
  X,
  ArrowRight,
  Play,
  Mail,
  Phone,
  MapPin,
  ChevronDown
} from 'lucide-react';
import SEO from '../components/SEO';
import betterClinicLogo from '../assets/betterclinic-logo.png';
import dashboardPreview from '../assets/main dashboard.png';
import appointmentsImg from '../assets/appointments.png';
import patientFilesImg from '../assets/patients-files.png';
import reportsImg from '../assets/reports.png';
import voiceReportingImg from '../assets/voice-reporting.png';
import paymentsImg from '../assets/payments.png';
import whatsappSmsImg from '../assets/whatsapp and sms .png';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPricingAnnual, setIsPricingAnnual] = useState(false);

  // Structured Data for SEO
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is Better Clinic secure for patient data?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, Better Clinic follows Indian data protection standards with enterprise-grade security measures, encrypted data storage, and regular security audits to protect patient information."
        }
      },
      {
        "@type": "Question",
        "name": "How does WhatsApp integration work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Better Clinic seamlessly integrates with WhatsApp to send appointment reminders, test results, and important updates directly to your patients' WhatsApp numbers."
        }
      },
      {
        "@type": "Question",
        "name": "What kind of support do you provide?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We offer 24/7 customer support via chat, email, and phone. Our Pro plan includes dedicated account management and priority support in Hindi and English."
        }
      },
      {
        "@type": "Question",
        "name": "Does Better Clinic work on mobile devices?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, Better Clinic is fully responsive and works perfectly on tablets and smartphones. You can manage your clinic from anywhere, anytime."
        }
      },
      {
        "@type": "Question",
        "name": "How does audio reporting work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our voice-to-text technology allows you to record patient consultations and automatically generate reports, saving you time on documentation."
        }
      }
    ]
  };

  const features = [
    {
      icon: <Users className="w-8 h-8 text-[#6C4CF3]" />,
      title: "Patient Management",
      description: "Complete patient registration, medical history tracking, and profile management in one simple interface."
    },
    {
      icon: <Users className="w-8 h-8 text-[#6C4CF3]" />,
      title: "Staff Management",
      description: "Manage your clinic staff, assign roles, track performance, and maintain team schedules effortlessly."
    },
    {
      icon: <Phone className="w-8 h-8 text-[#6C4CF3]" />,
      title: "WhatsApp Notifications",
      description: "Send appointment reminders, test results, and important updates directly through WhatsApp to your patients."
    },
    {
      icon: <Play className="w-8 h-8 text-[#6C4CF3]" />,
      title: "Audio Reporting",
      description: "Record patient consultations and generate reports using voice-to-text technology for faster documentation."
    },
    {
      icon: <Mail className="w-8 h-8 text-[#6C4CF3]" />,
      title: "WhatsApp & SMS Marketing",
      description: "Reach out to patients with health tips, promotional offers, and important clinic updates via WhatsApp and SMS."
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-[#6C4CF3]" />,
      title: "Revenue Analytics",
      description: "Track your clinic's financial performance with detailed analytics on payments, collections, and revenue trends."
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-[#6C4CF3]" />,
      title: "Analytics Dashboard",
      description: "Get real-time insights into patient flow, appointment patterns, and clinic performance with visual dashboards."
    },
    {
      icon: <FileText className="w-8 h-8 text-[#6C4CF3]" />,
      title: "Treatment Management",
      description: "Manage patient treatments, prescriptions, follow-ups, and treatment plans with our comprehensive system."
    }
  ];

  const faqs = [
    {
      question: "Is Better Clinic secure for patient data?",
      answer: "Yes, Better Clinic follows Indian data protection standards with enterprise-grade security measures, encrypted data storage, and regular security audits to protect patient information."
    },
    {
      question: "How does WhatsApp integration work?",
      answer: "Better Clinic seamlessly integrates with WhatsApp to send appointment reminders, test results, and important updates directly to your patients' WhatsApp numbers."
    },
    {
      question: "What kind of support do you provide?",
      answer: "We offer 24/7 customer support via chat, email, and phone. Our Pro plan includes dedicated account management and priority support in Hindi and English."
    },
    {
      question: "Does Better Clinic work on mobile devices?",
      answer: "Yes, Better Clinic is fully responsive and works perfectly on tablets and smartphones. You can manage your clinic from anywhere, anytime."
    },
    {
      question: "How does audio reporting work?",
      answer: "Our voice-to-text technology allows you to record patient consultations and automatically generate reports, saving you time on documentation."
    },
    {
      question: "How quickly can I get started?",
      answer: "You can be up and running in under 24 hours. Our onboarding team will help you set up your clinic data and train your staff at no extra cost."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title="BetterClinic - Best Clinic Management Software for Doctors, Dentists & Radiologists"
        description="Transform your medical practice with Better Clinic - India's leading clinic management software. Features patient management, WhatsApp integration, voice reporting, appointment scheduling, revenue analytics & more. Trusted by 250+ clinics. Start free trial!"
        keywords="better clinic, better clinic software, clinic management software, medical clinic software, healthcare management system, patient management system, doctor appointment software, radiology clinic software, dental clinic software, physiotherapy clinic software, clinic EHR software India, medical practice management, clinic scheduling software, patient records software, hospital management software India, clinic automation software, best clinic software, medical billing software India, clinic reporting software, WhatsApp clinic notifications, voice to text medical reporting"
        url="https://betterclinic.app/"
        structuredData={faqStructuredData}
      />
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center overflow-hidden" style={{ height: '50px' }}>
                <img 
                  src={betterClinicLogo} 
                  alt="Better Clinic Logo" 
                  className="h-22 w-auto"
                  style={{ 
                    objectFit: 'cover',
                    objectPosition: 'top center'
                  }}
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/features" className="text-gray-600 hover:text-[#6C4CF3] transition-colors">Features</Link>
              <a href="#pricing" className="text-gray-600 hover:text-[#6C4CF3] transition-colors">Pricing</a>
              <Link to="/about" className="text-gray-600 hover:text-[#6C4CF3] transition-colors">About</Link>
              <a href="#faq" className="text-gray-600 hover:text-[#6C4CF3] transition-colors">FAQ</a>
              <a href="#contact" className="text-gray-600 hover:text-[#6C4CF3] transition-colors">Contact</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <Link to="/login" className="text-gray-600 hover:text-[#6C4CF3] transition-colors">
                Login
              </Link>
              <Link 
                to="/signup" 
                className="bg-[#6C4CF3] text-white px-6 py-2 rounded-lg hover:bg-[#5b3dd9] transition-colors flex items-center space-x-2"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100">
            <div className="px-4 py-4 space-y-4">
              <Link to="/features" className="block text-gray-600 hover:text-[#6C4CF3] transition-colors">Features</Link>
              <a href="#pricing" className="block text-gray-600 hover:text-[#6C4CF3] transition-colors">Pricing</a>
              <Link to="/about" className="block text-gray-600 hover:text-[#6C4CF3] transition-colors">About</Link>
              <a href="#faq" className="block text-gray-600 hover:text-[#6C4CF3] transition-colors">FAQ</a>
              <a href="#contact" className="block text-gray-600 hover:text-[#6C4CF3] transition-colors">Contact</a>
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <Link to="/login" className="block text-gray-600 hover:text-[#6C4CF3] transition-colors">
                  Login
                </Link>
                <Link 
                  to="/signup" 
                  className="block bg-[#6C4CF3] text-white px-6 py-2 rounded-lg hover:bg-[#5b3dd9] transition-colors text-center"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-br from-[#9B8CFF]/10 via-blue-50 to-[#9B8CFF]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* News Banner */}
            <div className="inline-flex items-center space-x-2 bg-[#9B8CFF]/20 text-[#6C4CF3] px-4 py-2 rounded-full text-sm font-medium mb-8">
              <Star className="w-4 h-4" />
              <span>NEWS: Introducing our new AI Features</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              <span className="block">Better Clinic Software</span>
              <span className="text-[#6C4CF3] block">Best Clinic Management Solution</span>
            </h1>

            {/* Sub-headline */}
            <p className="text-xl text-gray-600 mb-8 max-w-4xl mx-auto">
              India's #1 clinic management software for Doctors, Dentists, Radiologists, and Physiotherapists. 
              Streamline patient management, appointments, payments, WhatsApp notifications, and voice reporting 
              with our comprehensive medical practice management system. Trusted by 250+ healthcare professionals.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                to="/signup" 
                className="bg-[#6C4CF3] text-white px-8 py-4 rounded-lg hover:bg-[#5b3dd9] transition-colors flex items-center space-x-2 text-lg font-medium"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button className="flex items-center space-x-2 text-gray-600 hover:text-[#6C4CF3] transition-colors">
                <Play className="w-5 h-5" />
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Dashboard Preview */}
            <div className="mt-16 max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-[#6C4CF3] rounded-full"></div>
                    <span className="ml-4 text-sm text-gray-500">Better Clinic Dashboard</span>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <img 
                    src={dashboardPreview} 
                    alt="Better Clinic Dashboard Preview" 
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              See Better Clinic in Action
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover how our simple and powerful features can transform your clinic management and make your practice more efficient.
            </p>
          </div>

          {/* App Screenshots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Patient Management Screenshot */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Patient Files</h3>
              </div>
              <div className="overflow-hidden">
                <img 
                  src={patientFilesImg} 
                  alt="Patient Files Management" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Appointments Screenshot */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Appointments</h3>
              </div>
              <div className="overflow-hidden">
                <img 
                  src={appointmentsImg} 
                  alt="Appointment Management" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Payments Screenshot */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Payments</h3>
              </div>
              <div className="overflow-hidden">
                <img 
                  src={paymentsImg} 
                  alt="Payments Management" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Reports Screenshot */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Reports</h3>
              </div>
              <div className="overflow-hidden">
                <img 
                  src={reportsImg} 
                  alt="Reports Management" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Voice Reporting Screenshot */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Voice Reporting</h3>
              </div>
              <div className="overflow-hidden">
                <img 
                  src={voiceReportingImg} 
                  alt="Voice Reporting" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* WhatsApp & SMS Communication Screenshot */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">WhatsApp & SMS</h3>
              </div>
              <div className="overflow-hidden">
                <img 
                  src={whatsappSmsImg} 
                  alt="WhatsApp and SMS Communication" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Features to Elevate Your Operations
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Designed with the tools and technology your healthcare organization needs to enhance efficiency, 
              improve patient outcomes, and ensure data security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Best Pricing for Your Needs
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Meet your healthcare management goals. No hidden fees, just powerful features.
            </p>
          </div>

          {/* Pricing Toggle */}
          <div className="flex justify-center mb-12">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                onClick={() => setIsPricingAnnual(false)}
                className={`px-6 py-2 rounded-md transition-colors ${
                  !isPricingAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsPricingAnnual(true)}
                className={`px-6 py-2 rounded-md transition-colors ${
                  isPricingAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Annually
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Basic Plan */}
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic Plan</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  ₹{isPricingAnnual ? '1,200' : '1,500'}/month
                </div>
                <p className="text-gray-600">Perfect for small practices</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Patient Management</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Basic WhatsApp Notifications</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Basic Analytics Dashboard</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Treatment Management</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Email Support</span>
                </li>
              </ul>

              <button className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 transition-colors">
                Start For Basic
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-xl border-2 border-[#6C4CF3] p-8 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-[#6C4CF3] text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro Plan</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  ₹{isPricingAnnual ? '12,000' : '15,000'}/month
                </div>
                <p className="text-gray-600">For growing practices</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Everything in Basic</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Staff Management</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Audio Reporting (Voice-to-Text)</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">WhatsApp & SMS Marketing</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">Advanced Revenue Analytics</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-[#6C4CF3]" />
                  <span className="text-gray-600">24/7 Support</span>
                </li>
              </ul>

              <button className="w-full bg-[#6C4CF3] text-white py-3 rounded-lg hover:bg-[#5b3dd9] transition-colors">
                Get Started with Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about Better Clinic
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-600">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Get in Touch
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Ready to transform your practice? Contact us today and let's discuss how Better Clinic can help you.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#9B8CFF]/20 rounded-lg flex items-center justify-center">
                  <Mail className="w-6 h-6 text-[#6C4CF3]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Email Us</h3>
                  <p className="text-gray-600">support@betterclinic.app</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#9B8CFF]/20 rounded-lg flex items-center justify-center">
                  <Phone className="w-6 h-6 text-[#6C4CF3]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Call Us</h3>
                  <p className="text-gray-600">+91 8766742410</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#9B8CFF]/20 rounded-lg flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-[#6C4CF3]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Visit Us</h3>
                  <p className="text-gray-600">Sky Loft, opposite Golf Course, Shastrinagar, Yerawada, Pune, Maharashtra 411006, India</p>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-gray-50 rounded-xl p-8">
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Practice Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                    placeholder="Your Practice Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                    placeholder="Tell us about your practice and how we can help..."
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#6C4CF3] text-white py-3 rounded-lg hover:bg-[#5b3dd9] transition-colors font-medium"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="mb-4">
                <img 
                  src={betterClinicLogo} 
                  alt="Better Clinic Logo" 
                  className="h-16 w-auto object-contain"
                />
              </div>
              <p className="text-gray-400 mb-6 max-w-md">
                Making doctors' lives easier and smarter with the simplest platform to use. 
                Transform your practice with Better Clinic.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#contact" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
                <li><Link to="/booking" className="hover:text-white transition-colors">Book Appointment</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Better Clinic. All rights reserved. | Better Clinic Software - Best Clinic Management System in India</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
