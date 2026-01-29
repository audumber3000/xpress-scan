import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { APP_URL } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="py-16 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center justify-start mb-4">
              <img src="/moralplus-logo.svg" alt="MolarPlus - Dental Clinic Management Software" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-gray-400 mb-4 max-w-md text-left">
              Smart practice management software for modern dental clinics. Best dental software and dental clinic
              management software — available on web and mobile.
            </p>
            <div className="flex space-x-4">
              <a href="mailto:support@molarplus.com" className="text-gray-400 hover:text-white transition-colors" aria-label="Email">
                <Mail className="w-5 h-5" />
              </a>
              <a href="tel:+918766742410" className="text-gray-400 hover:text-white transition-colors" aria-label="Phone">
                <Phone className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-gray-400">
              <li>
                <Link href="/features" className="hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/platform" className="hover:text-white transition-colors">
                  Platform
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/articles" className="hover:text-white transition-colors">
                  Articles
                </Link>
              </li>
              <li>
                <a href={`${APP_URL}/signup`} className="hover:text-white transition-colors">
                  Free Trial
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-gray-400">
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} MolarPlus. All rights reserved. Made with care for dental professionals.
        </div>
      </div>
    </footer>
  );
}
