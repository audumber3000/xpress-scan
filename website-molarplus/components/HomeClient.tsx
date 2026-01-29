'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users } from 'lucide-react';
import { colors } from '@/lib/seo';

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
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">Mobile App Experience</h2>
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
    </section>
  );
}
