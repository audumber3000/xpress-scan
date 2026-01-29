'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { colors } from '@/lib/seo';
import { APP_URL } from '@/lib/constants';

export default function Nav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-white/98 backdrop-blur-md border-b border-gray-100 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center justify-center">
            <img
              src="/moralplus-logo.svg"
              alt="MolarPlus - Dental Clinic Management Software"
              className="h-12 w-auto"
            />
          </Link>
          <div className="hidden md:flex items-center space-x-10">
            <Link href="/features" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Features
            </Link>
            <Link href="/platform" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Platform
            </Link>
            <Link href="/pricing" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Pricing
            </Link>
            <Link href="/about" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Contact
            </Link>
            <Link href="/articles" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Articles
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <a
              href={`${APP_URL}/login`}
              className="px-6 py-2 text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Login
            </a>
            <a
              href={`${APP_URL}/signup`}
              className="px-8 py-3 rounded-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: colors.primary }}
            >
              Get Started
            </a>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-4 py-4 space-y-4">
            <Link href="/features" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              Features
            </Link>
            <Link href="/platform" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              Platform
            </Link>
            <Link href="/pricing" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              Pricing
            </Link>
            <Link href="/about" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              About
            </Link>
            <Link href="/contact" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              Contact
            </Link>
            <Link href="/articles" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              Articles
            </Link>
            <a
              href={`${APP_URL}/login`}
              className="block text-center px-6 py-3 text-gray-700 hover:text-blue-600 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Login
            </a>
            <a
              href={`${APP_URL}/signup`}
              className="block text-center px-6 py-3 rounded-lg font-semibold text-white"
              style={{ backgroundColor: colors.primary }}
              onClick={() => setIsMenuOpen(false)}
            >
              Get Started
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
