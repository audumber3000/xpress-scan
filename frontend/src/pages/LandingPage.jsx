import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu,
  X,
  ArrowRight,
  Calendar,
  Users,
  FileText,
  BarChart3,
  MessageSquare,
  Shield,
  Smartphone,
  Laptop,
  Clock,
  TrendingUp,
  Heart,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import SEO from '../components/SEO';

const MolarPlusLanding = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  // Mobile app screenshots
  const mobileScreens = [
    {
      src: '/mobileScreens/appoiment_screen.png',
      title: 'Effortless Appointments',
      description: 'Manage your schedule with ease and send automated reminders to patients'
    },
    {
      src: '/mobileScreens/patient_list.png',
      title: 'Patient Records',
      description: 'Access complete patient histories and treatment plans securely'
    },
    {
      src: '/mobileScreens/calender.png',
      title: 'Smart Calendar',
      description: 'View your schedule with intuitive monthly and daily calendar views'
    },
    {
      src: '/mobileScreens/add_patietns.png',
      title: 'Quick Onboarding',
      description: 'Add new patients to your clinic in just a few simple steps'
    },
    {
      src: '/mobileScreens/appoitment_details.png',
      title: 'Appointment Details',
      description: 'View comprehensive appointment information and patient notes'
    },
    {
      src: '/mobileScreens/image.png',
      title: 'Clean Interface',
      description: 'Professional design built specifically for dental practices'
    }
  ];

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying || isDragging) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % mobileScreens.length);
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, [isAutoPlaying, isDragging, mobileScreens.length]);

  // Drag handlers
  const handleDragStart = (e) => {
    setIsDragging(true);
    setIsAutoPlaying(false);
    setDragStartX(e.clientX || e.touches[0].clientX);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const currentX = e.clientX || e.touches[0].clientX;
    const diff = currentX - dragStartX;
    setDragOffset(diff);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    
    const threshold = 50; // Minimum drag distance to change slide
    if (Math.abs(dragOffset) > threshold) {
      if (dragOffset > 0) {
        setCurrentSlide((prev) => (prev - 1 + mobileScreens.length) % mobileScreens.length);
      } else {
        setCurrentSlide((prev) => (prev + 1) % mobileScreens.length);
      }
    }
    
    setIsDragging(false);
    setDragOffset(0);
    setTimeout(() => setIsAutoPlaying(true), 2000); // Resume auto-play after 2 seconds
  };

  // Slider navigation functions
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % mobileScreens.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + mobileScreens.length) % mobileScreens.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Brand colors
  const colors = {
    primary: '#2a276e',
    secondary: '#4a4694',
    dark: '#1a1548',
    light: '#f8f9fa',
    accent: '#6366f1'
  };

  // Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "MolarPlus",
    "url": "https://molarplus.app",
    "logo": "/molar-plus-logo-cropped.svg",
    "description": "Smart practice management software for modern dental clinics. Available on web and mobile.",
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
      "email": "support@molarplus.app",
      "availableLanguage": ["English", "Hindi"]
    }
  };

  const features = [
    {
      icon: <Calendar className="w-8 h-8" />,
      title: "Appointment Scheduling",
      description: "Smart booking system with automated reminders and calendar integration"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Patient Management",
      description: "Complete patient records with treatment history and documents"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure Records",
      description: "HIPAA-compliant data storage with end-to-end encryption"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Clinic Analytics",
      description: "Real-time insights into clinic performance and revenue"
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Staff & Workflow",
      description: "Team management with role-based access and task tracking"
    },
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: "Mobile Access",
      description: "Full-featured mobile app for iOS and Android"
    }
  ];

  const benefits = [
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Save Time on Admin",
      description: "Reduce paperwork by 80% with automated workflows"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Fewer Missed Appointments",
      description: "Automated reminders reduce no-shows by 60%"
    },
    {
      icon: <Heart className="w-6 h-6" />,
      title: "Better Patient Experience",
      description: "Digital forms and quick check-ins improve satisfaction"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Improved Clinic Visibility",
      description: "Track performance metrics and grow your practice"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title="MolarPlus - Smart Practice Management for Modern Dentists"
        description="MolarPlus is a comprehensive dental clinic management platform. Manage appointments, patient records, analytics, and workflows from web and mobile. Built for modern dental practices."
        keywords="dental clinic software, practice management, dental software, patient management, appointment scheduling, clinic analytics, dental practice software, dental EHR"
        url="https://molarplus.app/"
        structuredData={structuredData}
      />

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/98 backdrop-blur-md border-b border-gray-100 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center justify-center">
              <img 
                src="/moralplus-logo.svg" 
                alt="MolarPlus" 
                className="h-12 w-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </Link>
            <div className="hidden md:flex items-center space-x-10">
              <Link to="/features" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Features</Link>
              <Link to="/platform" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Platform</Link>
              <Link to="/pricing" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Pricing</Link>
              <Link to="/contact" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Contact</Link>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <Link 
                to="/login" 
                className="px-6 py-2 text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Login
              </Link>
              <Link 
                to="/signup" 
                className="px-8 py-3 rounded-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                style={{ backgroundColor: colors.primary }}
                onMouseEnter={(e) => e.target.style.backgroundColor = colors.dark}
                onMouseLeave={(e) => e.target.style.backgroundColor = colors.primary}
              >
                Get Started
              </Link>
            </div>
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
              <Link to="/features" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Features</Link>
              <Link to="/platform" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Platform</Link>
              <Link to="/pricing" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Pricing</Link>
              <Link to="/contact" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>Contact</Link>
              <Link 
                to="/login" 
                className="block text-center px-6 py-3 text-gray-700 hover:text-blue-600 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
              <Link 
                to="/signup" 
                className="block text-center px-6 py-3 rounded-lg font-semibold text-white"
                style={{ backgroundColor: colors.primary }}
                onClick={() => setIsMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 50%, #f8f9ff 100%)' }}>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl" style={{ backgroundColor: colors.primary }}></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: colors.secondary }}></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div 
                className="inline-flex items-center px-6 py-3 rounded-full text-sm font-semibold mb-8 border"
                style={{ 
                  backgroundColor: `${colors.primary}10`,
                  color: colors.primary,
                  borderColor: `${colors.primary}20`
                }}
              >
                <span className="mr-2">🦷</span>
                Built specifically for dental practices
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-8 leading-tight">
                You take care of smiles.<br />
                <span 
                  className="bg-gradient-to-r bg-clip-text text-transparent"
                  style={{ 
                    backgroundImage: `linear-gradient(to right, ${colors.primary}, ${colors.secondary})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  We take care of everything else.
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                MolarPlus brings appointments, patient records, and daily clinic operations together in one simple platform - helping dentists spend less time on administration and more time doing what they do best: caring for patients
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link 
                  to="/signup" 
                  className="px-8 py-4 rounded-xl text-lg font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 text-white inline-flex items-center justify-center"
                  style={{ backgroundColor: colors.primary }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = colors.dark}
                  onMouseLeave={(e) => e.target.style.backgroundColor = colors.primary}
                >
                  Get Started <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <a 
                  href="#contact" 
                  className="px-8 py-4 font-semibold text-lg border-2 border-gray-300 rounded-xl hover:border-blue-500 transition-all inline-flex items-center justify-center"
                >
                  Book a Demo
                </a>
              </div>
              
              {/* App Store Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <a 
                  href="#" 
                  className="inline-flex items-center justify-center px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors min-w-[160px]"
                >
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs font-medium">Download on the</div>
                    <div className="text-sm font-semibold">App Store</div>
                  </div>
                </a>
                <a 
                  href="#" 
                  className="inline-flex items-center justify-center px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors min-w-[160px]"
                >
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs font-medium">GET IT ON</div>
                    <div className="text-sm font-semibold">Google Play</div>
                  </div>
                </a>
              </div>

              </div>
            <div className="relative">
              {/* Mockup Image */}
              <div className="relative z-10 lg:translate-x-8">
                <img 
                  src="/mockup-hero.png" 
                  alt="MolarPlus App Mockup" 
                  className="w-full h-auto lg:w-[120%] lg:max-w-none"
                  onError={(e) => {
                    console.error('Mockup image failed to load');
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              {/* Background elements */}
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <div className="text-center">
                  <div className="text-8xl mb-4">🦷</div>
                  <div className="text-6xl">👨‍⚕️</div>
                </div>
              </div>
            </div>
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
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: `${colors.primary}10` }}>
                <Laptop className="w-10 h-10" style={{ color: colors.primary }} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Web Dashboard</h3>
              <p className="text-gray-600">Full-featured desktop interface for comprehensive clinic management</p>
            </div>
            <div className="text-center p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: `${colors.secondary}10` }}>
                <Smartphone className="w-10 h-10" style={{ color: colors.secondary }} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Mobile Apps</h3>
              <p className="text-gray-600">Native iOS and Android apps for on-the-go access</p>
            </div>
            <div className="text-center p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: `${colors.accent}10` }}>
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
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Everything you need to run your dental practice efficiently</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1 border border-gray-100"
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${colors.primary}10` }}
                >
                  <div style={{ color: colors.primary }}>
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App Gallery */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Mobile App Experience</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Professional-grade mobile app designed for dental professionals. Intuitive, fast, and reliable.
            </p>
          </div>
          
          <div className="relative max-w-6xl mx-auto">
            {/* Feature Cards - Left Side */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-64 space-y-4 opacity-0 animate-fade-in-left">
              {currentSlide >= 2 && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 transform transition-all duration-700">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colors.primary}10` }}>
                    <Calendar className="w-6 h-6" style={{ color: colors.primary }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {mobileScreens[(currentSlide - 2 + mobileScreens.length) % mobileScreens.length].title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {mobileScreens[(currentSlide - 2 + mobileScreens.length) % mobileScreens.length].description}
                  </p>
                </div>
              )}
            </div>
            
            {/* Feature Cards - Right Side */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 space-y-4 opacity-0 animate-fade-in-right">
              {currentSlide < mobileScreens.length - 2 && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 transform transition-all duration-700">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${colors.secondary}10` }}>
                    <Users className="w-6 h-6" style={{ color: colors.secondary }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {mobileScreens[(currentSlide + 2) % mobileScreens.length].title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {mobileScreens[(currentSlide + 2) % mobileScreens.length].description}
                  </p>
                </div>
              )}
            </div>
            
            {/* Center Phone Mockup */}
            <div className="relative mx-auto w-80 h-[640px]">
              {/* Phone Frame - Modern iPhone-like Design */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-[2.5rem] shadow-2xl border border-gray-700 overflow-hidden">
                {/* Glass Effect Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-[2.5rem]"></div>
                
                {/* Phone Screen */}
                <div className="absolute inset-1 bg-black rounded-[2.2rem] overflow-hidden">
                  {/* Dynamic Island Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-full z-20 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black rounded-full"></div>
                  </div>
                  
                  {/* Status Bar */}
                  <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-8 z-10">
                    <div className="text-white text-xs font-semibold">9:41</div>
                    <div className="flex items-center space-x-1">
                      <div className="w-4 h-3 border border-white/60 rounded-sm"></div>
                      <div className="w-1 h-2 bg-white rounded-full"></div>
                      <div className="w-4 h-3 bg-white rounded-sm"></div>
                    </div>
                  </div>
                  
                  {/* App Screens Slider */}
                  <div 
                    className="absolute inset-0 pt-8"
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                  >
                    <div 
                      className="flex h-full transition-transform duration-700 ease-out"
                      style={{ 
                        transform: `translateX(calc(-${currentSlide * 100}% + ${dragOffset}px))`,
                        transition: isDragging ? 'none' : 'transform 0.7s ease-out'
                      }}
                    >
                      {mobileScreens.map((screen, index) => (
                        <div key={index} className="w-full h-full flex-shrink-0 bg-white flex items-center justify-center">
                          <img 
                            src={screen.src}
                            alt={screen.title}
                            className="w-full h-full object-cover"
                            draggable={false}
                            onError={(e) => {
                              console.error(`Failed to load image: ${screen.src}`);
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Home Indicator Bar */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/60 rounded-full"></div>
                </div>
                
                {/* Side Buttons */}
                <div className="absolute right-0 top-24 w-1 h-12 bg-gray-700 rounded-l-full"></div>
                <div className="absolute right-0 top-40 w-1 h-12 bg-gray-700 rounded-l-full"></div>
                <div className="absolute right-0 top-56 w-1 h-8 bg-gray-700 rounded-l-full"></div>
                <div className="absolute left-0 top-48 w-1 h-16 bg-gray-700 rounded-r-full"></div>
                
                {/* Camera Lenses */}
                <div className="absolute top-8 left-8 w-2 h-2 bg-gray-900 rounded-full border border-gray-700"></div>
                <div className="absolute top-8 left-12 w-2 h-2 bg-gray-800 rounded-full border border-gray-600"></div>
                <div className="absolute top-10 left-10 w-3 h-3 bg-gray-900 rounded-full border-2 border-gray-700"></div>
              </div>
              
              {/* Current Feature Info */}
              <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 text-center w-80">
                <h3 className="text-2xl font-bold text-gray-900 mb-2 transition-all duration-500">
                  {mobileScreens[currentSlide].title}
                </h3>
                <p className="text-gray-600 transition-all duration-500">
                  {mobileScreens[currentSlide].description}
                </p>
              </div>
            </div>
            
            {/* Navigation Dots */}
            <div className="flex justify-center space-x-2 mt-36">
              {mobileScreens.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentSlide(index);
                    setIsAutoPlaying(false);
                    setTimeout(() => setIsAutoPlaying(true), 3000);
                  }}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'w-8' 
                      : 'hover:w-4'
                  }`}
                  style={{ 
                    backgroundColor: index === currentSlide ? colors.primary : '#d1d5db',
                    transition: 'all 0.3s ease'
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
            
            {/* Auto-play Indicator */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${isAutoPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                {isAutoPlaying ? 'Auto-playing' : 'Paused'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes fade-in-left {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fade-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-fade-in-left {
          animation: fade-in-left 0.7s ease-out forwards;
        }
        
        .animate-fade-in-right {
          animation: fade-in-right 0.7s ease-out forwards;
        }
      `}</style>

      {/* Benefits Section */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Benefits for Dentists</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Focus on what matters most - your patients</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ backgroundColor: `${colors.primary}10` }}
                >
                  <div style={{ color: colors.primary }}>
                    {benefit.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)` }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white"></div>
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-white"></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto">
            Join hundreds of dental practices already using MolarPlus to streamline their operations and improve patient care.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link 
              to="/signup" 
              className="px-10 py-4 rounded-xl text-lg font-semibold bg-white text-blue-600 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 inline-flex items-center justify-center"
            >
              Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <a 
              href="#contact" 
              className="px-10 py-4 rounded-xl text-lg font-semibold text-white border-2 border-white hover:bg-white hover:text-blue-600 transition-all inline-flex items-center justify-center"
            >
              Schedule Demo
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center justify-center mb-4">
                <img 
                  src="/moralplus-logo.svg" 
                  alt="MolarPlus" 
                  className="h-10 w-auto"
                />
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                Smart practice management software for modern dental clinics. 
                Available on web and mobile platforms.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Mail className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Phone className="w-5 h-5" />
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/platform" className="hover:text-white transition-colors">Platform</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Free Trial</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
            © 2024 MolarPlus. All rights reserved. Made with ❤️ for dental professionals.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MolarPlusLanding;
