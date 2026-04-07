import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { 
  ChevronLeft, 
  CreditCard, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  Lock,
  Tag,
  Sparkles
} from 'lucide-react';
import GearLoader from '../components/GearLoader';
import { cashfreeService } from '../services/payments/cashfree/cashfree_service';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const planName = queryParams.get('plan') || 'professional';
  
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [discountInfo, setDiscountInfo] = useState(null);

  // Hardcoded price for professional as per user request (₹1200)
  const basePrice = planName === 'professional' ? 1200 : 0;

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsValidating(true);
    try {
      const resp = await api.post('/subscriptions/validate-coupon', {
        code: couponCode,
        plan_name: planName
      });
      if (resp.is_valid) {
        setDiscountInfo(resp);
        toast.success(resp.message);
      } else {
        setDiscountInfo(null);
        toast.error(resp.message);
      }
    } catch (error) {
      toast.error('Coupon validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePayNow = async () => {
    setLoading(true);
    try {
      await cashfreeService.initiateCheckout(planName, discountInfo ? couponCode : null);
    } catch (error) {
      toast.error(error.message || 'Failed to initiate checkout');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><GearLoader /></div>;

  return (
    <div className="min-h-screen bg-[#f1f3f9]">
      {/* Professional Header */}
      <nav className="bg-[#2a276e] py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/subscription')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400 underline" />
            <span className="text-lg font-bold text-white tracking-tight">MolarPlus <span className="opacity-70 font-medium">Checkout</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-md border border-white/10">
          <Lock className="w-3.5 h-3.5" />
          SECURE PAYMENT
        </div>
      </nav>

      <div className="p-6 md:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8 items-start">
            
            {/* Order Summary - 2 cols on md */}
            <div className="md:col-span-2 space-y-6">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
                Order Summary
              </h2>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-[#2a276e]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 capitalize">{planName} Plan</h3>
                      <p className="text-xs text-gray-500">Monthly Subscription</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Base Price</span>
                    <span className="font-bold text-gray-900">₹{basePrice}</span>
                  </div>
                </div>

                <div className="p-6 space-y-3 bg-gray-50/50">
                  {discountInfo && (
                    <div className="flex justify-between items-center text-sm text-green-700">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Tag className="w-3.5 h-3.5" />
                        Discount Applied
                      </span>
                      <span className="font-bold">-₹{discountInfo.discount_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="font-bold text-gray-900 uppercase text-xs tracking-wider">Total to Pay</span>
                    <span className="text-xl font-black text-[#2a276e]">₹{discountInfo ? discountInfo.final_amount : basePrice}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500 bg-white p-4 rounded-xl border border-gray-200">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <p>Transactions are encrypted and secured by Cashfree Payments.</p>
              </div>
            </div>

            {/* Payment Details - 3 cols on md */}
            <div className="md:col-span-3 space-y-6">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
                Payment Details
              </h2>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                {/* Coupon Section */}
                <div className="mb-8 p-6 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                  <label className="text-[10px] font-bold text-[#2a276e] uppercase tracking-widest mb-3 block">Apply Coupon Code</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Enter Promo Code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#2a276e]/10 outline-none transition-all"
                    />
                    <button 
                      onClick={handleApplyCoupon}
                      disabled={isValidating || !couponCode}
                      className="bg-[#2a276e] text-white px-6 rounded-lg font-bold text-xs hover:bg-[#1A1640] transition-colors disabled:opacity-50"
                    >
                      {isValidating ? 'VALIDATING...' : 'APPLY'}
                    </button>
                  </div>
                  {discountInfo && (
                    <p className="text-[11px] text-green-700 font-bold mt-3 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Awesome! {discountInfo.message} (₹{discountInfo.discount_amount} savings)
                    </p>
                  )}
                </div>

                <div className="space-y-4 mb-8">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Method</p>
                  <div className="p-4 border border-[#2a276e] rounded-xl bg-indigo-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-[#2a276e]" />
                      <span className="text-sm font-bold text-[#2a276e]">Cashfree Secure Payment</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-[#2a276e]" />
                  </div>
                  <p className="text-[10px] text-gray-400 pl-1 italic">Supports UPI, All Cards, Netbanking.</p>
                </div>

                <button 
                  onClick={handlePayNow}
                  className="w-full bg-[#2a276e] text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-[#1A1640] transition-all active:scale-[0.98] flex items-center justify-center gap-2 group uppercase tracking-widest"
                >
                  Pay ₹{discountInfo ? discountInfo.final_amount : basePrice} Securely
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <div className="mt-8 flex flex-col items-center gap-3 opacity-40">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Secured by</span>
                  <img src="https://www.cashfree.com/pwa-assets/brand-logo/cashfree-payments-logo-footer.svg" alt="Cashfree" className="h-4" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
