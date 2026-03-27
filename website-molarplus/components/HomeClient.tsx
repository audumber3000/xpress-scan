'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Layout, 
  Smartphone, 
  ShieldCheck, 
  CalendarRange, 
  Users2, 
  ClipboardList, 
  BarChart3,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { colors } from '@/lib/seo';
import Link from 'next/link';

const mobileScreens = [
  { src: '/mobileScreens/appoiment_screen.png', title: 'Effortless Appointments', description: 'Manage your schedule with ease and send automated reminders to patients' },
  { src: '/mobileScreens/patient_list.png', title: 'Patient Records', description: 'Access complete patient histories and treatment plans securely' },
  { src: '/mobileScreens/calender.png', title: 'Smart Calendar', description: 'View your schedule with intuitive monthly and daily calendar views' },
  { src: '/mobileScreens/add_patietns.png', title: 'Quick Onboarding', description: 'Add new patients to your clinic in just a few simple steps' },
  { src: '/mobileScreens/appoitment_details.png', title: 'Appointment Details', description: 'View comprehensive appointment information and patient notes' },
  { src: '/mobileScreens/image.png', title: 'Clean Interface', description: 'Professional design built specifically for dental practices' },
];

export default function HomeClient() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!isAutoPlaying || isDragging) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % mobileScreens.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, isDragging]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    setIsAutoPlaying(false);
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragStartX(x);
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragOffset(x - dragStartX);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    const threshold = 50;
    if (Math.abs(dragOffset) > threshold) {
      if (dragOffset > 0) {
        setCurrentSlide((prev) => (prev - 1 + mobileScreens.length) % mobileScreens.length);
      } else {
        setCurrentSlide((prev) => (prev + 1) % mobileScreens.length);
      }
    }
    setIsDragging(false);
    setDragOffset(0);
    setTimeout(() => setIsAutoPlaying(true), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-gradient-to-br from-blue-50/50 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-10">
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full">
                <span className="text-xl">🦷</span>
                <span className="text-sm font-bold text-blue-900 uppercase tracking-wider">#1 dental platform for dentists</span>
              </div>
              
              <div className="space-y-6">
                <h1 className="text-4xl md:text-5xl font-extrabold text-[#1a1c4b] leading-[1.1]">
                  You take care of smiles.<br />
                  <span className="text-[#3b448f]">We take care of you Dr.</span>
                </h1>
                <p className="text-xl text-gray-600 max-w-xl leading-relaxed">
                  MolarPlus brings appointments, patient records, and daily clinic operations together in one simple platform — helping dentists spend less time on administration and more time doing what they do best: caring for patients.
                </p>
              </div>

              <div className="flex flex-wrap gap-5">
                <a href="https://app.molarplus.com/signup" className="group px-10 py-5 bg-[#2a276e] text-white rounded-2xl font-bold text-lg hover:bg-[#1a184e] transition-all shadow-xl hover:shadow-2xl flex items-center">
                  Get Started
                  <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a href="#contact" className="px-10 py-5 bg-white text-gray-900 border-2 border-gray-100 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all shadow-sm">
                  Book a Demo
                </a>
              </div>

              <div className="flex items-center space-x-4 pt-4">
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-12 w-auto cursor-pointer grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Play Store" className="h-12 w-auto cursor-pointer grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all" />
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 bg-blue-400/10 rounded-full blur-3xl" />
              <img
                src="/mockup-hero.png"
                alt="MolarPlus Platform Mockup"
                className="relative z-10 w-full h-auto drop-shadow-[0_35px_35px_rgba(0,0,0,0.15)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c4b]">
              Why Choose the Best Dental Software and Dental Clinic Management Software?
            </h2>
            <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
              <p>
                Finding the <strong className="text-[#1a1c4b]">best dental software</strong> for your practice can transform how you manage appointments, patient records, and daily operations. <strong className="text-[#1a1c4b]">Dental clinic management software</strong> like MolarPlus gives dentists and clinic staff one unified platform for scheduling, patient management, billing, and analytics — so you spend less time on admin and more time with patients.
              </p>
              <p>
                MolarPlus is built to be the <strong className="text-[#1a1c4b]">best dental software</strong> choice for clinics that want reliability, ease of use, and strong support. Our <strong className="text-[#1a1c4b]">dental clinic management software</strong> covers appointments, patient files, payments, and analytics in a single platform. Explore our <Link href="/features" className="text-blue-600 hover:underline">features</Link> and <Link href="/pricing" className="text-blue-600 hover:underline">pricing</Link>, or <Link href="/contact" className="text-blue-600 hover:underline">contact us</Link> for a demo.
              </p>
              <Link href="/blog" className="inline-flex items-center text-blue-600 font-bold hover:underline">
                Read more blog posts on dental software and clinic management
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Complete Platform Solution */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c4b]">Complete Platform Solution</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              MolarPlus works seamlessly across all your devices. Manage your clinic from anywhere, anytime.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Layout className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-[#1a1c4b] mb-4">Web Dashboard</h3>
              <p className="text-gray-600 text-lg">Full-featured desktop interface for comprehensive clinic management.</p>
            </div>
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Smartphone className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-[#1a1c4b] mb-4">Mobile Apps</h3>
              <p className="text-gray-600 text-lg">Native iOS and Android apps for on-the-go access.</p>
            </div>
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-[#1a1c4b] mb-4">Secure Sync</h3>
              <p className="text-gray-600 text-lg">Real-time synchronization across all your devices.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Powerful Features */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c4b]">Powerful Features</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Everything you need to run your dental practice efficiently</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <CalendarRange className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#1a1c4b] mb-3">Appointment Scheduling</h3>
              <p className="text-gray-600">Smart booking system with automated reminders and calendar integration.</p>
            </div>
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Users2 className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#1a1c4b] mb-3">Patient Management</h3>
              <p className="text-gray-600">Complete patient records with treatment history and documents.</p>
            </div>
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#1a1c4b] mb-3">Secure Records</h3>
              <p className="text-gray-600">HIPAA-compliant data storage with end-to-end encryption.</p>
            </div>
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#1a1c4b] mb-3">Clinic Analytics</h3>
              <p className="text-gray-600">Real-time insights into clinic performance and revenue.</p>
            </div>
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#1a1c4b] mb-3">Staff & Workflow</h3>
              <p className="text-gray-600">Team management with role-based access and task tracking.</p>
            </div>
            <div className="p-10 rounded-3xl border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Smartphone className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#1a1c4b] mb-3">Mobile Access</h3>
              <p className="text-gray-600">Full-featured mobile app for iOS and Android.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile App Slider (Experience Section) */}
      <div id="experience" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c4b]">Mobile App Experience</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Professional-grade mobile app designed for dental professionals. Intuitive, fast, and reliable.
            </p>
          </div>

          <div className="relative max-w-6xl mx-auto">
            <div className="relative mx-auto w-80 h-[640px]">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-[2.5rem] shadow-2xl border border-gray-700 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-[2.5rem]" />
                <div className="absolute inset-1 bg-black rounded-[2.2rem] overflow-hidden">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-full z-20 shadow-lg" />
                  <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-8 z-10">
                    <div className="text-white text-xs font-semibold">9:41</div>
                    <div className="flex items-center space-x-1">
                      <div className="w-4 h-3 border border-white/60 rounded-sm" />
                      <div className="w-1 h-2 bg-white rounded-full" />
                      <div className="w-4 h-3 bg-white rounded-sm" />
                    </div>
                  </div>
                  <div
                    className="absolute inset-0 pt-8 flex h-full transition-transform duration-700 ease-out"
                    style={{
                      transform: `translateX(calc(-${currentSlide * 100}% + ${dragOffset}px))`,
                      transition: isDragging ? 'none' : 'transform 0.7s ease-out',
                    }}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                  >
                    {mobileScreens.map((screen, index) => (
                      <div key={index} className="w-full h-full flex-shrink-0 bg-white flex items-center justify-center">
                        <img
                          src={screen.src}
                          alt={screen.title}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/60 rounded-full" />
                </div>
                <div className="absolute right-0 top-24 w-1 h-12 bg-gray-700 rounded-l-full" />
                <div className="absolute right-0 top-40 w-1 h-12 bg-gray-700 rounded-l-full" />
                <div className="absolute right-0 top-56 w-1 h-8 bg-gray-700 rounded-l-full" />
                <div className="absolute left-0 top-48 w-1 h-16 bg-gray-700 rounded-r-full" />
              </div>
              <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 text-center w-80">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{mobileScreens[currentSlide].title}</h3>
                <p className="text-gray-600">{mobileScreens[currentSlide].description}</p>
              </div>
            </div>

            <div className="flex justify-center space-x-2 mt-36">
              {mobileScreens.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setCurrentSlide(index);
                    setIsAutoPlaying(false);
                    setTimeout(() => setIsAutoPlaying(true), 3000);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8' : 'w-2 hover:w-4'}`}
                  style={{ backgroundColor: index === currentSlide ? colors.primary : '#d1d5db' }}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${isAutoPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {isAutoPlaying ? 'Auto-playing' : 'Paused'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
