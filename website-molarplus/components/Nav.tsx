'use client';

import Link from 'next/link';
import { Menu, X, Search, Globe, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { colors } from '@/lib/seo';
import { APP_URL } from '@/lib/constants';

export default function Nav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-white/98 backdrop-blur-md border-b border-gray-100 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex flex-col items-end group">
            <img
              src="/molarplus-logo-transparent.svg"
              alt="MolarPlus"
              className="h-11 w-auto transition-transform group-hover:scale-105"
            />
            <div className="text-[9px] font-bold mt-0.5 tracking-tight leading-none pr-2">
              <span className="text-gray-400 font-medium mr-0.5">by</span>
              <span className="text-[#73a942]">Clino</span>
              <span className="text-[#245501] ml-1">Health</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/features" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Pricing
            </Link>
            <Link href="/about" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              About
            </Link>
            <Link href="/blog" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Blog
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center space-x-5 text-gray-500 border-r border-gray-200 pr-6 mr-2">
              <button className="hover:text-blue-600 transition-all hover:scale-110">
                <Search className="w-5 h-5" />
              </button>
              <button className="flex items-center gap-1.5 hover:text-blue-600 transition-all group">
                <Globe className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <div className="flex items-center gap-0.5">
                  <span className="text-sm font-bold tracking-tight">IN</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </button>
            </div>

            <Link 
              href="/find-dentist" 
              className="px-5 py-2.5 rounded-xl border-2 border-blue-600/20 bg-blue-50/50 hover:bg-blue-600 hover:border-blue-600 group transition-all duration-300 shadow-sm flex items-center space-x-2"
            >
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-blue-900 group-hover:text-white uppercase tracking-tighter leading-none">Find a Dentist</span>
                <span className="text-[9px] font-medium text-blue-600 group-hover:text-blue-50 uppercase tracking-widest leading-none mt-1">near you</span>
              </div>
            </Link>
            
            <a
              href={`${APP_URL}/login`}
              className="px-6 py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-900/10 hover:shadow-blue-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: colors.primary }}
            >
              Login / Signup
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
            <Link href="/pricing" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              Pricing
            </Link>
            <Link href="/about" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              About
            </Link>
            <Link href="/blog" className="block text-gray-700 hover:text-blue-600 transition-colors" onClick={() => setIsMenuOpen(false)}>
              Blog
            </Link>
            <Link 
              href="/find-dentist" 
              className="flex flex-col items-center justify-center w-full py-3 rounded-xl border-2 border-blue-600/20 bg-blue-50"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="text-xs font-bold text-blue-900 uppercase tracking-tight">Find a Dentist</span>
              <span className="text-[10px] font-medium text-blue-600 uppercase tracking-widest">near you</span>
            </Link>
            <a
              href={`${APP_URL}/login`}
              className="block text-center px-6 py-3 text-gray-700 hover:text-blue-600 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Login
            </a>
            <a
              href="https://app.molarplus.com/signup"
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
