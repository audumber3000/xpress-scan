import { SITE_NAME, colors } from '@/lib/seo';
import Link from 'next/link';
import { Facebook, Linkedin, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <>
      <footer className="bg-[#1a1548] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
            {/* Column 1: Logo & Info */}
            <div className="lg:col-span-1">
              <Link href="/" className="inline-block mb-6">
                <img
                  src="/molarplus-logo-transparent.svg"
                  alt="MolarPlus"
                  className="h-14 w-auto brightness-0 invert"
                />
              </Link>
              <p className="text-blue-100/70 text-sm leading-relaxed mb-8 font-medium">
                Best Dental Clinic Management Software To Make Your Work Easy And Efficient!
              </p>
              <div className="flex space-x-4">
                <a href="#" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="#" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h3 className="text-white font-bold text-lg mb-6">Quick Links</h3>
              <ul className="space-y-4 text-blue-100/60 text-sm font-semibold">
                <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blogs</Link></li>
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              </ul>
            </div>

            {/* Column 3: Our Resources */}
            <div>
              <h3 className="text-white font-bold text-lg mb-6">Our Resources</h3>
              <ul className="space-y-4 text-gray-400 text-sm font-semibold">
                <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Terms of Use</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Cookies Policy</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
              </ul>
            </div>

            {/* Column 4: Support */}
            <div>
              <h3 className="text-white font-bold text-lg mb-6">Support</h3>
              <ul className="space-y-4 text-blue-100/60 text-sm font-semibold">
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link href="/find-dentist" className="hover:text-white transition-colors">Find Doctors</Link></li>
                <li><a href="mailto:support@molarplus.com" className="hover:text-white transition-colors">support@molarplus.com</a></li>
                <li className="leading-tight text-xs mt-4">
                  Sky Loft, Shastrinagar,<br />
                  Yerawada, Pune 411006
                </li>
              </ul>
            </div>

            {/* Column 5: Download Apps */}
            <div>
              <h3 className="text-white font-bold text-lg mb-6 tracking-tight">Download Apps</h3>
              <div className="flex flex-col space-y-4 max-w-[160px]">
                <a 
                  href="https://apps.apple.com/app/molarplus" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="transition-transform hover:scale-105 active:scale-95"
                >
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" 
                    alt="Download on App Store" 
                    className="w-full h-auto" 
                  />
                </a>
                <a 
                  href="https://play.google.com/store/apps/details?id=com.molarplus.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="transition-transform hover:scale-105 active:scale-95"
                >
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" 
                    alt="Get it on Google Play" 
                    className="w-full h-auto" 
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <div className="bg-[#120e3a] py-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-blue-100/30">
          <p className="text-[12px] font-bold uppercase tracking-wider">
            © {new Date().getFullYear()} {SITE_NAME} Powered by Upclick labs (OPC) Pvt. ltd.
          </p>
        </div>
      </div>
    </>
  );
}
