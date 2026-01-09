import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu,
  X,
  ArrowRight,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Wifi,
  DollarSign,
  Headphones,
  Shield,
  Users,
  Calendar,
  FileText,
  BarChart3,
  MessageSquare,
  Mic,
  TrendingUp
} from 'lucide-react';
import SEO from '../components/SEO';
import clinoHealthLogoFull from '../assets/clino-health-logo-full.svg';
import dashboardPreview from '../assets/main dashboard.png';
import appointmentsImg from '../assets/appointments.png';
import patientFilesImg from '../assets/patients-files.png';
import reportsImg from '../assets/reports.png';
import voiceReportingImg from '../assets/voice-reporting.png';
import paymentsImg from '../assets/payments.png';
import whatsappSmsImg from '../assets/whatsapp and sms .png';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Color palette
  const colors = {
    dark: '#143601',
    medium: '#245501',
    light: '#73a942'
  };

  // Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Clino Health",
    "url": "https://clinohealth.app",
    "logo": "https://clinohealth.app/clino-health-logo-full.svg",
    "description": "Healthcare software solutions built for modern clinics in India. BDent for dental, BSono for sonography.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Pune",
      "addressRegion": "Maharashtra",
      "addressCountry": "IN"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-8766742410",
      "contactType": "Customer Service",
      "email": "support@clinohealth.app",
      "availableLanguage": ["English", "Hindi"]
    }
  };

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Does Clino Health software work offline?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Our software works 100% offline. All data is stored locally. Internet is only needed for cloud sync (optional) and updates."
        }
      },
      {
        "@type": "Question",
        "name": "How affordable is Clino Health software?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We offer one-time payment options with no expensive monthly fees. Our pricing is designed to be affordable for clinics of all sizes."
        }
      },
      {
        "@type": "Question",
        "name": "What kind of support do you provide?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We offer 24/7 customer support via WhatsApp and phone in Hindi and English. Our team is always here to help."
        }
      },
      {
        "@type": "Question",
        "name": "Is my patient data secure?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Absolutely. With our desktop version, your data never leaves your computer. It's stored in an encrypted local database with complete privacy."
        }
      }
    ]
  };

  const products = [
    {
      name: "BDent",
      icon: "🦷",
      description: "Dental practice management software",
      status: "Available",
      statusColor: "bg-[#73a942]/10 text-[#143601]",
      link: "/bdent"
    },
    {
      name: "BSono",
      icon: "🔊",
      description: "Sonography center management",
      status: "Coming Soon",
      statusColor: "bg-yellow-100 text-yellow-700",
      link: "#"
    },
    {
      name: "BPhysio",
      icon: "💪",
      description: "Physiotherapy clinic management",
      status: "Coming Soon",
      statusColor: "bg-gray-200 text-gray-600",
      link: "#"
    },
    {
      name: "BPath",
      icon: "🔬",
      description: "Pathology lab management",
      status: "Coming Soon",
      statusColor: "bg-gray-200 text-gray-600",
      link: "#"
    }
  ];

  const features = [
    {
      icon: <Wifi className="w-8 h-8" style={{ color: colors.medium }} />,
      title: "Works Offline",
      description: "No internet? No problem. Your clinic keeps running seamlessly."
    },
    {
      icon: <DollarSign className="w-8 h-8" style={{ color: colors.medium }} />,
      title: "Affordable",
      description: "One-time payment. No expensive monthly fees or hidden charges."
    },
    {
      icon: <Headphones className="w-8 h-8" style={{ color: colors.medium }} />,
      title: "Local Support",
      description: "WhatsApp & phone support in Hindi/English. Always here to help."
    },
    {
      icon: <Shield className="w-8 h-8" style={{ color: colors.medium }} />,
      title: "Your Data, Your Control",
      description: "Data stored locally. Complete privacy and security guaranteed."
    }
  ];

  const whyUsFeatures = [
    {
      icon: <CheckCircle className="w-6 h-6" style={{ color: colors.medium }} />,
      title: "Made for Indian Clinics",
      description: "Designed with Indian healthcare workflows in mind. Supports local languages and payment methods."
    },
    {
      icon: <CheckCircle className="w-6 h-6" style={{ color: colors.medium }} />,
      title: "Easy to Use",
      description: "Intuitive interface that your staff can learn in minutes. No complex training required."
    },
    {
      icon: <CheckCircle className="w-6 h-6" style={{ color: colors.medium }} />,
      title: "Regular Updates",
      description: "We continuously improve based on feedback from real clinics. Your software gets better over time."
    }
  ];

  const faqs = [
    {
      question: "Does Clino Health software work offline?",
      answer: "Yes! Our software works 100% offline. All data is stored locally. Internet is only needed for cloud sync (optional) and updates."
    },
    {
      question: "How affordable is Clino Health software?",
      answer: "We offer one-time payment options with no expensive monthly fees. Our pricing is designed to be affordable for clinics of all sizes."
    },
    {
      question: "What kind of support do you provide?",
      answer: "We offer 24/7 customer support via WhatsApp and phone in Hindi and English. Our team is always here to help."
    },
    {
      question: "Is my patient data secure?",
      answer: "Absolutely. With our desktop version, your data never leaves your computer. It's stored in an encrypted local database with complete privacy."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title="Clino Health - Healthcare Software Solutions Built for India"
        description="Clino Health builds healthcare software for modern clinics. BDent for dental, BSono for sonography. Simple, affordable, and designed to work offline. Trusted by 250+ clinics across India."
        keywords="clino health, healthcare software, clinic management software, dental software, sonography software, medical practice management, patient management system, clinic software India, healthcare management system, medical software offline, clinic management India"
        url="https://clinohealth.app/"
        structuredData={structuredData}
        faqStructuredData={faqStructuredData}
      />

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/98 backdrop-blur-md border-b border-gray-100 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center space-x-3">
              <img 
                src={clinoHealthLogoFull} 
                alt="Clino Health" 
                className="h-12 w-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) {
                    e.target.nextSibling.style.display = 'block';
                  }
                }}
              />
              <span className="hidden text-2xl font-bold">
                <span style={{ color: colors.light }}>Clino</span>{' '}
                <span style={{ color: colors.dark }}>Health</span>
              </span>
              </Link>
            <div className="hidden md:flex items-center space-x-10">
              <a href="#products" className="text-gray-700 hover:text-[#245501] font-medium transition-colors">Products</a>
              <a href="#features" className="text-gray-700 hover:text-[#245501] font-medium transition-colors">Features</a>
              <a href="#why-us" className="text-gray-700 hover:text-[#245501] font-medium transition-colors">Why Us</a>
              <a href="#contact" className="text-gray-700 hover:text-[#245501] font-medium transition-colors">Contact</a>
            </div>
              <Link 
                to="/signup" 
              className="hidden md:flex items-center px-8 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
              style={{ backgroundColor: colors.medium, color: 'white' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = colors.dark}
              onMouseLeave={(e) => e.target.style.backgroundColor = colors.medium}
              >
              Get Started
              </Link>
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
              <a href="#products" className="block text-gray-700 hover:text-[#245501] transition-colors" onClick={() => setIsMenuOpen(false)}>Products</a>
              <a href="#features" className="block text-gray-700 hover:text-[#245501] transition-colors" onClick={() => setIsMenuOpen(false)}>Features</a>
              <a href="#why-us" className="block text-gray-700 hover:text-[#245501] transition-colors" onClick={() => setIsMenuOpen(false)}>Why Us</a>
              <a href="#contact" className="block text-gray-700 hover:text-[#245501] transition-colors" onClick={() => setIsMenuOpen(false)}>Contact</a>
                <Link 
                  to="/signup" 
                className="block text-center px-6 py-3 rounded-lg font-semibold text-white"
                style={{ backgroundColor: colors.medium }}
                onClick={() => setIsMenuOpen(false)}
                >
                  Get Started
                </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0f9f0 0%, #ffffff 50%, #f0f9f0 100%)' }}>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl" style={{ backgroundColor: colors.light }}></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: colors.medium }}></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div 
              className="inline-flex items-center px-6 py-3 rounded-full text-sm font-semibold mb-8 border"
              style={{ 
                backgroundColor: `${colors.light}10`,
                color: colors.dark,
                borderColor: `${colors.light}20`
              }}
            >
              <span className="mr-2">🏥</span>
              Building the future of healthcare software
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-8 leading-tight">
              Healthcare Software<br />
              <span 
                className="bg-gradient-to-r bg-clip-text text-transparent"
                style={{ 
                  backgroundImage: `linear-gradient(to right, ${colors.dark}, ${colors.medium})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Built for India
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              We build specialized clinic management software for healthcare professionals. 
              Simple, affordable, and designed to work offline. Trusted by 250+ clinics across India.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <a 
                href="#products" 
                className="px-10 py-4 rounded-xl text-lg font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 text-white"
                style={{ backgroundColor: colors.medium }}
                onMouseEnter={(e) => e.target.style.backgroundColor = colors.dark}
                onMouseLeave={(e) => e.target.style.backgroundColor = colors.medium}
              >
                Explore Products ↓
              </a>
              <a 
                href="#contact" 
                className="text-gray-700 hover:text-[#245501] px-10 py-4 font-semibold text-lg border-2 border-gray-300 rounded-xl hover:border-[#245501] transition-all"
              >
                Contact Sales →
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20">
              <div className="text-center">
                <div className="text-5xl font-extrabold mb-2" style={{ color: colors.medium }}>250+</div>
                <div className="text-gray-600 font-medium">Clinics</div>
                  </div>
              <div className="text-center">
                <div className="text-5xl font-extrabold mb-2" style={{ color: colors.medium }}>50K+</div>
                <div className="text-gray-600 font-medium">Patients</div>
                </div>
              <div className="text-center">
                <div className="text-5xl font-extrabold mb-2" style={{ color: colors.medium }}>99.9%</div>
                <div className="text-gray-600 font-medium">Uptime</div>
                </div>
              <div className="text-center">
                <div className="text-5xl font-extrabold mb-2" style={{ color: colors.medium }}>24/7</div>
                <div className="text-gray-600 font-medium">Support</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Our Products</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Specialized software solutions for different healthcare practices</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {products.map((product, index) => (
              <a
                key={index}
                href={product.link}
                className="group border-2 rounded-2xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-2 bg-white"
                style={{ 
                  borderColor: product.status === 'Available' ? `${colors.light}30` : '#e5e7eb',
                  ...(product.status === 'Available' && {
                    ':hover': { borderColor: colors.medium }
                  })
                }}
              >
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-colors"
                  style={{ 
                    backgroundColor: product.status === 'Available' ? `${colors.light}10` : '#f3f4f6'
                  }}
                >
                  <span className="text-4xl">{product.icon}</span>
              </div>
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 ${product.statusColor}`}>
                  {product.status}
                </span>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{product.name}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>
                {product.status === 'Available' && (
                  <span className="font-semibold" style={{ color: colors.medium }}>
                    Learn more →
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Powerful Features</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Everything you need to run your clinic efficiently</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1 border border-gray-100"
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${colors.light}10` }}
                >
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">See Clino Health in Action</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover how our simple and powerful features can transform your clinic management
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { img: patientFilesImg, title: "Patient Files" },
              { img: appointmentsImg, title: "Appointments" },
              { img: paymentsImg, title: "Payments" },
              { img: reportsImg, title: "Reports" },
              { img: voiceReportingImg, title: "Voice Reporting" },
              { img: whatsappSmsImg, title: "WhatsApp & SMS" }
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                </div>
                <div className="overflow-hidden">
                  <img src={item.img} alt={item.title} className="w-full h-auto object-cover" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us Section */}
      <section id="why-us" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Why Clino Health?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Built specifically for Indian healthcare providers</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
            <div className="space-y-8">
                {whyUsFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div 
                      className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${colors.medium}20` }}
                    >
                      {feature.icon}
                </div>
                <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-gray-600">{feature.description}</p>
                </div>
              </div>
                ))}
              </div>
            </div>
            <div 
              className="rounded-3xl p-12 border"
              style={{ 
                background: `linear-gradient(to bottom right, ${colors.light}10, ${colors.medium}10)`,
                borderColor: `${colors.light}20`
              }}
            >
              <div className="text-center">
                <div className="text-6xl font-extrabold mb-4" style={{ color: colors.medium }}>250+</div>
                <div className="text-2xl font-semibold text-gray-900 mb-8">Clinics Trust Us</div>
                <div className="space-y-4 text-left">
                  {[
                    "50,000+ patients managed",
                    "99.9% uptime guarantee",
                    "24/7 customer support"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6" style={{ color: colors.medium }} />
                      <span className="text-gray-700">{item}</span>
                </div>
                  ))}
                </div>
              </div>
            </div>
                  </div>
                </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Get in Touch</h2>
          <p className="text-xl text-gray-600 mb-12">Ready to transform your practice? Let's talk.</p>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <a 
              href="https://wa.me/918766742410" 
              className="flex flex-col items-center justify-center space-y-3 px-8 py-6 rounded-2xl font-semibold transition-all border-2 transform hover:-translate-y-1"
              style={{ 
                backgroundColor: `${colors.light}10`,
                color: colors.dark,
                borderColor: `${colors.light}20`
              }}
            >
              <span className="text-4xl">📱</span>
              <span>WhatsApp</span>
            </a>
            <a 
              href="mailto:support@clinohealth.app" 
              className="flex flex-col items-center justify-center space-y-3 px-8 py-6 rounded-2xl font-semibold transition-all border-2 transform hover:-translate-y-1"
              style={{ 
                backgroundColor: `${colors.medium}10`,
                color: colors.dark,
                borderColor: `${colors.medium}20`
              }}
            >
              <span className="text-4xl">✉️</span>
              <span>Email</span>
            </a>
            <a 
              href="tel:+918766742410" 
              className="flex flex-col items-center justify-center space-y-3 px-8 py-6 rounded-2xl font-semibold transition-all border-2 transform hover:-translate-y-1"
              style={{ 
                backgroundColor: `${colors.dark}10`,
                color: colors.dark,
                borderColor: `${colors.dark}20`
              }}
            >
              <span className="text-4xl">📞</span>
              <span>+91 8766742410</span>
            </a>
            </div>
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <p className="text-gray-700 font-medium mb-2">📍 Based in Pune, Maharashtra</p>
            <p className="text-gray-600">Serving clinics across India</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 text-white" style={{ backgroundColor: colors.dark }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12">
            <div className="mb-6 md:mb-0">
              <img 
                src={clinoHealthLogoFull} 
                alt="Clino Health" 
                className="h-12 w-auto brightness-0 invert"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-gray-300">
              <a href="#products" className="hover:text-white transition-colors font-medium">Products</a>
              <a href="#features" className="hover:text-white transition-colors font-medium">Features</a>
              <a href="#why-us" className="hover:text-white transition-colors font-medium">Why Us</a>
              <a href="#contact" className="hover:text-white transition-colors font-medium">Contact</a>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-700 text-center text-gray-400 text-sm">
            © 2024 Clino Health. Made with ❤️ in India.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
