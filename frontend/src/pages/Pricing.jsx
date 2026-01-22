import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Star, Users, Shield } from 'lucide-react';
import SEO from '../components/SEO';

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const colors = {
    primary: '#2a276e',
    secondary: '#4a4694',
    dark: '#1a1548',
    light: '#f8f9fa',
    accent: '#6366f1'
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "MolarPlus Pricing Plans",
    "description": "Flexible pricing plans for dental practices of all sizes. Start free, scale as you grow.",
    "brand": {
      "@type": "Brand",
      "name": "MolarPlus"
    },
    "offers": [
      {
        "@type": "Offer",
        "name": "Starter Plan",
        "price": "1499",
        "priceCurrency": "INR",
        "billingDuration": "P1M"
      },
      {
        "@type": "Offer", 
        "name": "Professional Plan",
        "price": "4999",
        "priceCurrency": "INR",
        "billingDuration": "P1M"
      },
      {
        "@type": "Offer",
        "name": "Enterprise Plan",
        "price": "9999",
        "priceCurrency": "INR", 
        "billingDuration": "P1M"
      }
    ]
  };

  const plans = [
    {
      name: "Starter",
      description: "Perfect for small dental practices",
      monthlyPrice: 1499,
      yearlyPrice: 14990,
      features: [
        "Up to 3 practitioners",
        "500 patient records",
        "Basic appointment scheduling",
        "Mobile app access",
        "Email support",
        "Basic reporting",
        "Data backup",
        "HIPAA compliance"
      ],
      excluded: [
        "Advanced analytics",
        "Custom branding",
        "API access",
        "Priority support"
      ],
      popular: false
    },
    {
      name: "Professional",
      description: "Ideal for growing dental clinics",
      monthlyPrice: 4999,
      yearlyPrice: 49990,
      features: [
        "Up to 10 practitioners",
        "Unlimited patient records",
        "Advanced scheduling",
        "Mobile & tablet apps",
        "Priority email & phone support",
        "Advanced analytics dashboard",
        "Automated backups",
        "Custom treatment plans",
        "Online booking portal",
        "Payment processing",
        "Insurance claims",
        "HIPAA compliance"
      ],
      excluded: [
        "White-label options",
        "Custom integrations"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      description: "For large dental practices and groups",
      monthlyPrice: 9999,
      yearlyPrice: 99990,
      features: [
        "Unlimited practitioners",
        "Unlimited patient records",
        "Enterprise scheduling",
        "All platform access",
        "24/7 dedicated support",
        "Custom analytics",
        "Advanced security features",
        "White-label options",
        "Custom integrations",
        "API access",
        "Training & onboarding",
        "Custom workflows",
        "Multi-location support"
      ],
      excluded: [],
      popular: false
    }
  ];

  const getDisplayPrice = (plan) => {
    return billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  };

  const getBillingText = () => {
    return billingCycle === 'monthly' ? '/month' : '/year (Save 17%)';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="Pricing - Dental Practice Management Software Plans | MolarPlus"
        description="Flexible pricing plans for dental practices of all sizes. Start with our free trial, choose from Starter, Professional, or Enterprise plans. No hidden fees."
        keywords="dental software pricing, practice management cost, dental clinic software plans, affordable dental software, dental practice management pricing"
        url="https://molarplus.app/pricing"
        structuredData={structuredData}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Choose the perfect plan for your dental practice. Start with a free trial, no credit card required.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center space-x-4">
              <span className={`text-lg ${billingCycle === 'monthly' ? 'font-semibold' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors"
                style={{ backgroundColor: billingCycle === 'yearly' ? colors.primary : '#d1d5db' }}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-lg ${billingCycle === 'yearly' ? 'font-semibold' : 'text-gray-500'}`}>
                Yearly <span className="text-green-600 text-sm">(Save 17%)</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div 
                key={index} 
                className={`bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all ${
                  plan.popular ? 'ring-2 ring-blue-600 transform scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full text-center mb-4">
                    Most Popular
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold" style={{ color: colors.primary }}>
                      ₹{getDisplayPrice(plan)}
                    </span>
                    <span className="text-gray-500 ml-2">{getBillingText()}</span>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                  {plan.excluded.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start opacity-50">
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-500">{feature}</span>
                    </div>
                  ))}
                </div>

                <Link 
                  to="/signup"
                  className={`w-full py-3 rounded-lg font-semibold text-center block transition-colors ${
                    plan.popular 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Comparison */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Compare All Features
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to manage your dental practice
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-4 px-4">Feature</th>
                  <th className="text-center py-4 px-4">Starter</th>
                  <th className="text-center py-4 px-4">Professional</th>
                  <th className="text-center py-4 px-4">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Patient Management", starter: true, professional: true, enterprise: true },
                  { feature: "Appointment Scheduling", starter: true, professional: true, enterprise: true },
                  { feature: "Mobile App Access", starter: true, professional: true, enterprise: true },
                  { feature: "Advanced Analytics", starter: false, professional: true, enterprise: true },
                  { feature: "Online Booking", starter: false, professional: true, enterprise: true },
                  { feature: "Payment Processing", starter: false, professional: true, enterprise: true },
                  { feature: "API Access", starter: false, professional: false, enterprise: true },
                  { feature: "Custom Integrations", starter: false, professional: false, enterprise: true },
                  { feature: "24/7 Support", starter: false, professional: false, enterprise: true }
                ].map((row, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-4 px-4 font-medium">{row.feature}</td>
                    <td className="text-center py-4 px-4">
                      {row.starter ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.professional ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.enterprise ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Dental Professionals
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Dr. Sarah Johnson",
                practice: "Smile Dental Clinic",
                content: "MolarPlus transformed our practice. We save 10+ hours per week on administrative tasks.",
                rating: 5
              },
              {
                name: "Dr. Michael Chen",
                practice: "Family Dental Care",
                content: "The mobile app is incredible. I can manage my practice from anywhere.",
                rating: 5
              },
              {
                name: "Dr. Emily Rodriguez",
                practice: "Modern Dentistry",
                content: "Best investment we made. Patient satisfaction has increased significantly.",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.practice}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of dental practices using MolarPlus
          </p>
          <Link 
            to="/signup" 
            className="inline-flex items-center justify-center space-x-2 bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
          >
            <span>Start Your Free Trial</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
