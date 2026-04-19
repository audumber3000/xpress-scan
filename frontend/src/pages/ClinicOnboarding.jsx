import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { 
  Building2, 
  Phone, 
  Stethoscope, 
  CreditCard, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Plus,
  Trash2,
  Check,
  Zap,
  ShieldCheck,
  User,
  GraduationCap,
  MapPin,
  Users
} from 'lucide-react';

const ClinicOnboarding = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: "",
    specialty: "",
    clinic_name: "",
    clinic_address: "",
    clinic_phone: "",
    clinic_email: "",
    number_of_chairs: "1",
    category: "General Dentistry",
    subscription_plan: "professional",
    billing_cycle: "monthly",
    scan_types: [
      { name: "Consultation", price: 300 },
      { name: "Teeth Cleaning", price: 800 },
      { name: "X-Ray (OPG)", price: 1200 }
    ]
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const userObj = JSON.parse(userData);
      setUser(userObj);
      setFormData(prev => ({
        ...prev,
        clinic_email: userObj.email,
        full_name: userObj.name || userObj.full_name || ""
      }));
    }
  }, []);

  const steps = [
    { id: 1, title: 'Profile', icon: <User className="w-5 h-5" /> },
    { id: 2, title: 'Clinic', icon: <Building2 className="w-5 h-5" /> },
    { id: 3, title: 'Insights', icon: <Users className="w-5 h-5" /> },
    { id: 4, title: 'Plan', icon: <CreditCard className="w-5 h-5" /> },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleScanTypeChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      scan_types: prev.scan_types.map((scan, i) => 
        i === index ? { ...scan, [field]: value } : scan
      )
    }));
  };

  const addScanType = () => {
    setFormData(prev => ({
      ...prev,
      scan_types: [...prev.scan_types, { name: "", price: 0 }]
    }));
  };

  const removeScanType = (index) => {
    setFormData(prev => ({
      ...prev,
      scan_types: prev.scan_types.filter((_, i) => i !== index)
    }));
  };

  const isValidStep = () => {
    if (currentStep === 1) return formData.full_name && formData.specialty;
    if (currentStep === 2) return formData.clinic_name && formData.clinic_address && formData.clinic_phone;
    if (currentStep === 3) return formData.number_of_chairs && formData.category;
    return true;
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    setLoading(true);
    try {
      const cleanPhone = formData.clinic_phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) throw new Error("Phone number must be at least 10 digits.");

      const referralCode = sessionStorage.getItem('referred_by_code');

      const result = await api.post('/auth/onboarding', {
        ...formData,
        number_of_chairs: parseInt(formData.number_of_chairs) || 1,
        specialization: formData.category,
        referred_by_code: referralCode
      });

      if (referralCode) sessionStorage.removeItem('referred_by_code');

      localStorage.setItem('user', JSON.stringify(result.user));
      toast.success("Welcome aboard, Dr.! MolarPlus is ready.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.message || "Onboarding failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="flex flex-col items-center gap-6">
      <img src="/molarplus-logo.svg" alt="MolarPlus" className="h-12 w-auto animate-pulse" />
      <div className="w-12 h-1 bg-[#2a276e]/10 rounded-full overflow-hidden">
        <div className="w-1/2 h-full bg-[#2a276e] animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
  </div>;

  return (
    <div className="min-h-screen bg-white flex font-sans overflow-hidden text-[#111827]">
      {/* Sidebar - Elegant & Illustrated */}
      <div className="w-[380px] bg-[#F8F9FF] border-r border-gray-100 hidden lg:flex flex-col relative overflow-hidden">
        {/* Abstract pattern bg */}
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%"><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2a276e" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
        </div>

        <div className="p-12 relative z-10 flex-1 flex flex-col justify-between">
          <div>
            <div className="mb-16">
              <img src="/molarplus-logo.svg" alt="MolarPlus" className="h-10 w-auto" />
            </div>

            <nav className="space-y-10">
              {steps.map((step) => (
                <div key={step.id} className="relative flex items-center gap-6 group">
                  {step.id < steps.length && (
                    <div className={`absolute left-[19px] top-10 w-0.5 h-10 ${currentStep > step.id ? 'bg-[#9B8CFF]' : 'bg-gray-200'}`} />
                  )}
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-700
                    ${currentStep === step.id ? 'bg-[#2a276e] text-white scale-110 shadow-xl' : 
                      currentStep > step.id ? 'bg-[#9B8CFF] text-white' : 'bg-white border-2 border-gray-100 text-gray-300'}
                  `}>
                    {currentStep > step.id ? <Check className="w-6 h-6" /> : step.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-black transition-colors duration-300 ${currentStep === step.id ? 'text-[#2a276e]' : 'text-gray-400'}`}>
                      {step.title}
                    </span>
                    {currentStep === step.id && <span className="text-[10px] font-bold text-[#9B8CFF] animate-pulse">Setting Up</span>}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="mt-auto pt-10">
            <div className="flex items-center gap-3 text-[10px] text-[#2a276e]/50 font-black">
               <ShieldCheck className="w-4 h-4" /> HIPAA Compliant System
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-8 md:p-24 relative overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col justify-between">
          <div>
            {/* Elegant Header */}
            <div className="mb-20 animate-in slide-in-from-top-4 duration-700">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-16 h-16 rounded-[24px] bg-[#f0f2ff] flex items-center justify-center text-[#2a276e]">
                  {React.cloneElement(steps[currentStep-1].icon, { className: "w-8 h-8" })}
                </div>
                <div>
                  <div className="text-[10px] font-black text-[#9B8CFF] mb-1">Section {currentStep}</div>
                  <h2 className="text-4xl font-black text-[#2a276e] tracking-tight">{steps[currentStep-1].title} Details</h2>
                </div>
              </div>
              <p className="text-xl text-gray-500 font-medium max-w-xl border-l-4 border-[#9B8CFF]/20 pl-6 py-1">
                {currentStep === 1 && "Start by identifying your professional persona. These details will be displayed for patient confidence."}
                {currentStep === 2 && "Enter your primary practice details. This information syncs with your official clinical headers."}
                {currentStep === 3 && "Help us configure your digital clinic ecosystem by providing practice volume and services."}
                {currentStep === 4 && "Finalize your infrastructure setup. Choose a plan or explore with our free foundational tier."}
              </p>
            </div>

            {/* Form Fields - Simple & Professional */}
            <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
              {currentStep === 1 && (
                <div className="grid grid-cols-1 gap-12">
                  <div className="group space-y-3">
                    <label className="text-xs font-black text-[#2a276e] flex items-center gap-2 group-focus-within:text-[#9B8CFF] transition-colors">
                      <User className="w-4 h-4" /> Full Professional Name
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="e.g. Dr. Rajesh Kumar"
                      className="w-full text-2xl font-bold bg-transparent border-b-2 border-gray-50 focus:border-[#9B8CFF] focus:outline-none py-4 placeholder-gray-200 transition-all font-sans"
                    />
                  </div>
                  <div className="group space-y-3">
                    <label className="text-xs font-black text-[#2a276e] flex items-center gap-2 group-focus-within:text-[#9B8CFF] transition-colors">
                      <GraduationCap className="w-4 h-4" /> Professional Degree / Specialty
                    </label>
                    <input
                      type="text"
                      name="specialty"
                      value={formData.specialty}
                      onChange={handleInputChange}
                      placeholder="e.g. BDS, MDS (Orthodontics)"
                      className="w-full text-2xl font-bold bg-transparent border-b-2 border-gray-50 focus:border-[#9B8CFF] focus:outline-none py-4 placeholder-gray-200 transition-all font-sans"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid grid-cols-1 gap-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="group space-y-3">
                      <label className="text-xs font-black text-[#2a276e] flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Clinic Brand Name
                      </label>
                      <input
                        type="text"
                        name="clinic_name"
                        value={formData.clinic_name}
                        onChange={handleInputChange}
                        placeholder="e.g. MolarPlus Dental Care"
                        className="w-full text-xl font-bold bg-transparent border-b-2 border-gray-50 focus:border-[#9B8CFF] focus:outline-none py-4 placeholder-gray-200 transition-all font-sans"
                      />
                    </div>
                    <div className="group space-y-3">
                      <label className="text-xs font-black text-[#2a276e] flex items-center gap-2">
                        <Phone className="w-4 h-4" /> WhatsApp / Contact
                      </label>
                      <input
                        type="tel"
                        name="clinic_phone"
                        value={formData.clinic_phone}
                        onChange={handleInputChange}
                        placeholder="+91 00000 00000"
                        className="w-full text-xl font-bold bg-transparent border-b-2 border-gray-50 focus:border-[#9B8CFF] focus:outline-none py-4 placeholder-gray-200 transition-all font-sans"
                      />
                    </div>
                  </div>
                  <div className="group space-y-3">
                    <label className="text-xs font-black text-[#2a276e] flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Clinical Address
                    </label>
                    <textarea
                      name="clinic_address"
                      value={formData.clinic_address}
                      onChange={handleInputChange}
                      rows={2}
                      placeholder="Suite #, Building Name, Street, City"
                      className="w-full text-xl font-bold bg-transparent border-b-2 border-gray-50 focus:border-[#9B8CFF] focus:outline-none py-4 placeholder-gray-200 transition-all font-sans resize-none"
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="grid grid-cols-1 gap-12">
                  <div className="space-y-6">
                    <label className="text-xs font-black text-[#2a276e] block">Clinical Capacity (Chairs)</label>
                    <div className="flex gap-4">
                      {['1', '2', '3', '4+'].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, number_of_chairs: val }))}
                          className={`
                            h-14 w-20 rounded-2xl border-2 font-black transition-all duration-300
                            ${formData.number_of_chairs === val ? 'bg-[#2a276e] border-[#2a276e] text-white shadow-xl scale-110' : 'bg-white border-gray-50 text-gray-400 hover:border-gray-200'}
                          `}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <label className="text-xs font-black text-[#2a276e] block">Clinical Focus Area</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {['General Dentistry', 'Orthodontics', 'Pediatric', 'Implantology', 'Cosmetic', 'Periodontics'].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                          className={`
                            px-5 py-4 rounded-2xl border-2 text-sm font-bold transition-all text-left
                            ${formData.category === cat ? 'bg-[#2a276e]/5 border-[#2a276e] text-[#2a276e] ring-4 ring-[#2a276e]/5' : 'bg-white border-gray-50 text-gray-400 hover:border-gray-200'}
                          `}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-xs font-black text-[#2a276e] block mb-4">Initial Product Catalog</label>
                    <div className="space-y-5">
                      {formData.scan_types.map((scan, index) => (
                        <div key={index} className="flex gap-6 items-center">
                          <input
                            type="text"
                            value={scan.name}
                            onChange={(e) => handleScanTypeChange(index, 'name', e.target.value)}
                            className="flex-1 text-lg font-bold bg-transparent border-b border-gray-50 focus:border-[#9B8CFF] focus:outline-none py-3"
                          />
                          <div className="w-32 relative">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#9B8CFF]">INR</span>
                            <input
                              type="number"
                              value={scan.price}
                              onChange={(e) => handleScanTypeChange(index, 'price', e.target.value)}
                              className="w-full pl-8 text-lg font-bold bg-transparent border-b border-gray-50 focus:border-[#9B8CFF] focus:outline-none py-3 text-right"
                            />
                          </div>
                          <button type="button" onClick={() => removeScanType(index)} className="text-gray-200 hover:text-red-500 transition-all p-2">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addScanType} className="flex items-center gap-2 text-[10px] font-black text-[#9B8CFF] hover:text-[#2a276e] transition-colors mt-8">
                      <Plus className="w-5 h-5" /> Expand Service Offering
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="flex flex-col items-center gap-8">
                  {/* Billing toggle */}
                  <div className="flex items-center gap-1 bg-[#F8F9FF] rounded-2xl p-1.5">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, billing_cycle: 'monthly' }))}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${formData.billing_cycle !== 'annual' ? 'bg-white text-[#2a276e] shadow-sm' : 'text-gray-400'}`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, billing_cycle: 'annual' }))}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${formData.billing_cycle === 'annual' ? 'bg-white text-[#2a276e] shadow-sm' : 'text-gray-400'}`}
                    >
                      Annual <span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full">25% OFF</span>
                    </button>
                  </div>

                  {/* Plan card */}
                  <div className="w-full max-w-sm p-10 rounded-[40px] bg-[#2a276e] text-white shadow-2xl">
                    <h4 className="text-xl font-black mb-1">MolarPlus Professional</h4>
                    <p className="text-xs opacity-60 mb-8">Everything you need to run your clinic</p>
                    <div className="mb-8 flex items-baseline gap-2">
                      {formData.billing_cycle === 'annual' ? (
                        <>
                          <span className="text-4xl font-black">₹675</span>
                          <span className="text-[10px] font-bold opacity-60">/month</span>
                          <span className="text-xs opacity-50 line-through ml-1">₹899</span>
                        </>
                      ) : (
                        <>
                          <span className="text-4xl font-black">₹899</span>
                          <span className="text-[10px] font-bold opacity-60">/month</span>
                        </>
                      )}
                    </div>
                    {formData.billing_cycle === 'annual' && (
                      <p className="text-xs opacity-70 -mt-4 mb-6">Billed as ₹8,100/year — save ₹1,488</p>
                    )}
                    <ul className="space-y-4 mb-10">
                      {['Unlimited Patients & Staff', 'WhatsApp Reminders', 'Treatment Planning', 'Lab Order Tracking', 'Revenue Dashboard', 'Weekly & Monthly Reports'].map(feat => (
                        <li key={feat} className="flex items-center gap-3 text-xs font-bold opacity-80">
                          <CheckCircle2 className="w-4 h-4" /> {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nav & Attribution */}
          <div className="pt-20 mt-12 border-t border-gray-50 flex flex-col items-center gap-10">
            <div className="w-full flex gap-6">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="w-16 h-16 bg-white border-2 border-gray-50 rounded-2xl flex items-center justify-center text-gray-300 hover:text-[#2a276e] hover:border-[#2a276e] transition-all group"
                >
                  <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
                </button>
              )}
                <button
                  type="button"
                  onClick={currentStep < 4 ? () => setCurrentStep(prev => prev + 1) : handleSubmit}
                  disabled={!isValidStep() || loading}
                  className="flex-1 h-16 bg-[#2a276e] text-white rounded-[24px] font-black text-sm shadow-2xl shadow-[#2a276e]/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30 transition-all flex items-center justify-center gap-4 group"
                >
                  {loading ? "Initializing Secure Vault..." : currentStep === 4 ? "Authorize Setup" : "Continue Integration"}
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>

            {currentStep === 4 && (
              <button
                type="button"
                onClick={() => { setFormData(prev => ({ ...prev, subscription_plan: 'free' })); handleSubmit(); }}
                className="text-[11px] font-black text-[#9B8CFF] hover:text-[#2a276e] transition-colors"
              >
                Continue with Free foundational tier for now
              </button>
            )}

            <div className="flex flex-col items-center gap-1 opacity-40">
              <div className="text-[10px] font-black text-gray-400">
                A product by Clino Health
              </div>
              <div className="text-[9px] font-bold text-gray-300">
                Upclick labs (OPC)
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        body, html { font-family: 'Inter', sans-serif; }
        
        @keyframes slide-in-from-bottom-6 {
          from { transform: translateY(2rem); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide-in-from-top-4 {
          from { transform: translateY(-1rem); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-in { animation: forwards ease-out; }
        .slide-in-from-bottom-6 { animation-name: slide-in-from-bottom-6; }
        .slide-in-from-top-4 { animation-name: slide-in-from-top-4; }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default ClinicOnboarding;