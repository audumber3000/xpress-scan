'use client';

import { useState } from 'react';
import { 
  Search, 
  MapPin, 
  Languages, 
  Star, 
  Calendar, 
  ArrowRight,
  Stethoscope,
  Building2,
  Navigation,
  ShieldCheck,
  Users
} from 'lucide-react';
import { colors } from '@/lib/seo';
import Link from 'next/link';

const DENTISTS = [
  {
    id: 1,
    name: 'Dr. Wyatt Shaffer',
    speciality: 'General Practitioner',
    location: 'Kalyani Nagar, Pune',
    rating: 4.9,
    reviews: 156,
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=250&h=250&auto=format&fit=crop',
    languages: ['English', 'Hindi', 'Marathi'],
    nextSlot: 'Today, 4:00 PM'
  },
  {
    id: 2,
    name: 'Dr. Rene Floyd',
    speciality: 'Pediatric Dentist',
    location: 'Koregaon Park, Pune',
    rating: 4.7,
    reviews: 89,
    image: 'https://images.unsplash.com/photo-1559839734-2b71f1536783?q=80&w=250&h=250&auto=format&fit=crop',
    languages: ['English', 'German'],
    nextSlot: 'Tomorrow, 10:00 AM'
  },
  {
    id: 3,
    name: 'Dr. Marlon Page',
    speciality: 'Orthodontist',
    location: 'Viman Nagar, Pune',
    rating: 4.8,
    reviews: 210,
    image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=250&h=250&auto=format&fit=crop',
    languages: ['English', 'Hindi'],
    nextSlot: 'Mon, 27 Mar'
  },
  {
    id: 4,
    name: 'Dr. Jazmyn Oliver',
    speciality: 'Endodontist',
    location: 'Magarpatta, Pune',
    rating: 4.6,
    reviews: 67,
    image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=250&h=250&auto=format&fit=crop',
    languages: ['English', 'Spanish'],
    nextSlot: 'In 2 days'
  },
  {
    id: 5,
    name: 'Dr. Claire Booth',
    speciality: 'Oral Surgeon',
    location: 'Baner, Pune',
    rating: 5.0,
    reviews: 43,
    image: 'https://images.unsplash.com/photo-1591604466107-ec972398526e?q=80&w=250&h=250&auto=format&fit=crop',
    languages: ['English', 'Hindi', 'Marathi'],
    nextSlot: 'Today, 2:30 PM'
  },
  {
    id: 6,
    name: 'Dr. Jamal Kisl',
    speciality: 'Periodontist',
    location: 'Aundh, Pune',
    rating: 4.5,
    reviews: 112,
    image: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=250&h=250&auto=format&fit=crop',
    languages: ['English', 'Russian'],
    nextSlot: 'Wed, 29 Mar'
  }
];

export default function FindDentistPage() {
  const [searchQuery, setSearchQuery] = useState({
    speciality: '',
    location: '',
  });
  const [isDetecting, setIsDetecting] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          
          if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.suburb || '';
            const road = data.address.road || '';
            const displayLocation = road ? `${road}, ${city}` : city;
            setSearchQuery(prev => ({ ...prev, location: displayLocation || 'Detected Location' }));
          } else {
            setSearchQuery(prev => ({ ...prev, location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
          }
        } catch (error) {
          console.error('Error fetching location:', error);
          alert('Unable to get address. Using coordinates instead.');
        } finally {
          setIsDetecting(false);
        }
      },
      () => {
        setIsDetecting(false);
        alert('Location permission denied. Please type manually.');
      }
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-[#7c66dc]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute bottom-0 left-0 w-full h-64 bg-repeat-x" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/city.png")' }} />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
              Find the Best Dentists &<br />Dental Clinics Near You
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">
              Connecting you with top-rated dental professionals for all your oral health needs. Simple, secure, and professional.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-3 md:p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-2">
              <div className="flex-[1.2] w-full relative">
                <div className="flex items-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <Stethoscope className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-1">Speciality</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Orthodontist"
                      className="w-full bg-transparent border-none focus:ring-0 focus:outline-none p-0 text-gray-900 font-semibold placeholder:text-gray-300 text-sm"
                      value={searchQuery.speciality}
                      onChange={(e) => setSearchQuery({...searchQuery, speciality: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 w-full relative">
                <div className="flex items-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors relative">
                  <MapPin className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-1">Location</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Pune, Maharashtra"
                      className="w-full bg-transparent border-none focus:ring-0 focus:outline-none p-0 text-gray-900 font-semibold placeholder:text-gray-300 text-sm"
                      value={searchQuery.location}
                      onChange={(e) => setSearchQuery({...searchQuery, location: e.target.value})}
                    />
                  </div>
                  <button 
                    onClick={handleGetLocation}
                    disabled={isDetecting}
                    className="p-2 hover:bg-white rounded-lg transition-all text-blue-600 group relative"
                    title="Use live location"
                  >
                    <Navigation className={`w-4 h-4 ${isDetecting ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                  </button>
                </div>
              </div>

              <button className="w-full md:w-auto h-[68px] md:h-auto px-12 py-4 bg-[#f15e5e] hover:bg-[#e04d4d] text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 text-lg">
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-8 py-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-50 rounded-3xl mb-4">
              <Star className="w-12 h-12 text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900">
              Personalized Dentist Recommendations <br />
              <span className="text-blue-600">Coming Soon</span>
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed">
              We're currently verifying and onboarding top-rated dental professionals in your area to ensure you get the best care possible. 
            </p>
            <div className="pt-8">
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#7c66dc] text-white font-bold rounded-2xl hover:bg-[#6b55c9] transition-all shadow-lg hover:shadow-xl"
              >
                Return to Home
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16">
              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                <ShieldCheck className="w-8 h-8 text-green-500 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900">Verified Pros</h3>
                <p className="text-xs text-gray-500 mt-1">Every doctor is manually verified for quality.</p>
              </div>
              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                <Calendar className="w-8 h-8 text-orange-500 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900">Instant Booking</h3>
                <p className="text-xs text-gray-500 mt-1">Book your slots directly with zero hassle.</p>
              </div>
              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                <Star className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900">Real Reviews</h3>
                <p className="text-xs text-gray-500 mt-1">Trusted feedback from real patients.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="py-16 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center justify-center gap-2 font-bold text-xl text-gray-400">
              <Building2 className="w-6 h-6" /> DentalAssoc
            </div>
            <div className="flex items-center justify-center gap-2 font-bold text-xl text-gray-400">
              <ShieldCheck className="w-6 h-6" /> HealthSecure
            </div>
            <div className="flex items-center justify-center gap-2 font-bold text-xl text-gray-400">
              <Users className="w-6 h-6" /> 1M+ Users
            </div>
            <div className="flex items-center justify-center gap-2 font-bold text-xl text-gray-400">
              <Navigation className="w-6 h-6" /> GlobalFinder
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
