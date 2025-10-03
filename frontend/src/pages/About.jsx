import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Users, Target, Award, Heart } from 'lucide-react';
import SEO from '../components/SEO';
import betterClinicLogo from '../assets/betterclinic-logo.png';

const About = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About BetterClinic",
    "description": "Learn about BetterClinic, India's leading clinic management software helping healthcare professionals streamline their practice management.",
    "publisher": {
      "@type": "Organization",
      "name": "BetterClinic",
      "logo": {
        "@type": "ImageObject",
        "url": "https://betterclinic.app/icons/icon-512x512.png"
      }
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="About BetterClinic - Leading Clinic Management Software in India"
        description="Discover how BetterClinic is revolutionizing healthcare management for doctors, dentists, and radiologists across India. Learn about our mission to simplify clinic operations with innovative technology."
        keywords="about better clinic, clinic management software company, healthcare software India, medical practice management, clinic software provider, healthcare technology India"
        url="https://betterclinic.app/about"
        type="website"
        structuredData={structuredData}
      />

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center overflow-hidden" style={{ height: '50px' }}>
                <img 
                  src={betterClinicLogo} 
                  alt="Better Clinic Logo" 
                  className="h-22 w-auto"
                />
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              <Link to="/" className="text-gray-600 hover:text-green-600 transition-colors">
                Home
              </Link>
              <Link 
                to="/signup" 
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-green-50 via-blue-50 to-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              About <span className="text-green-600">Better Clinic</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Making healthcare management simple, efficient, and accessible for medical professionals across India
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                At BetterClinic, we're on a mission to transform healthcare delivery in India by providing 
                doctors, dentists, radiologists, and physiotherapists with the best clinic management software 
                that simplifies their daily operations.
              </p>
              <p className="text-lg text-gray-600 mb-6">
                We understand the challenges healthcare professionals face - from managing patient records 
                and appointments to handling payments and communications. That's why we built a comprehensive 
                clinic management solution that addresses every aspect of practice management.
              </p>
              <p className="text-lg text-gray-600">
                Our platform combines cutting-edge technology with intuitive design, making it easy for 
                medical professionals to focus on what matters most - providing excellent patient care.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-green-50 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">250+</div>
                <div className="text-gray-600">Clinics Trust Us</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">10K+</div>
                <div className="text-gray-600">Patients Managed</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">50K+</div>
                <div className="text-gray-600">Appointments Scheduled</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-orange-600 mb-2">99.9%</div>
                <div className="text-gray-600">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our Values
            </h2>
            <p className="text-xl text-gray-600">
              The principles that guide everything we do
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <div className="mb-4">
                <Heart className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Patient-Centric
              </h3>
              <p className="text-gray-600">
                We believe in empowering healthcare providers to deliver exceptional patient care 
                through better clinic management tools and efficient workflows.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <div className="mb-4">
                <Target className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Simplicity First
              </h3>
              <p className="text-gray-600">
                We design our clinic management software to be intuitive and easy to use, 
                so healthcare professionals can focus on their patients, not on technology.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <div className="mb-4">
                <Award className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Innovation
              </h3>
              <p className="text-gray-600">
                We continuously innovate with features like WhatsApp integration, voice reporting, 
                and AI-powered analytics to stay ahead in healthcare technology.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Healthcare Professionals Choose BetterClinic
            </h2>
            <p className="text-xl text-gray-600">
              The better clinic software trusted by medical professionals across India
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex items-start space-x-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Complete Clinic Management Solution
                </h3>
                <p className="text-gray-600">
                  Everything you need to run your clinic - from patient management to revenue tracking
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Built for Indian Healthcare
                </h3>
                <p className="text-gray-600">
                  Designed specifically for Indian clinics with local payment methods and WhatsApp integration
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  24/7 Support in Hindi & English
                </h3>
                <p className="text-gray-600">
                  Get help whenever you need it in your preferred language
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Secure & HIPAA Compliant
                </h3>
                <p className="text-gray-600">
                  Enterprise-grade security to protect patient data and maintain confidentiality
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Affordable Pricing
                </h3>
                <p className="text-gray-600">
                  Starting at just ₹1,500/month - the best value clinic management software in India
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Quick Setup & Training
                </h3>
                <p className="text-gray-600">
                  Get started in 24 hours with free onboarding and staff training
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-green-600 to-green-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-green-50 mb-8">
            Join 250+ healthcare professionals using BetterClinic to manage their practice better
          </p>
          <Link 
            to="/signup" 
            className="inline-flex items-center space-x-2 bg-white text-green-600 px-8 py-4 rounded-lg hover:bg-gray-50 transition-colors text-lg font-medium"
          >
            <span>Start Your Free Trial</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2024 Better Clinic. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;

