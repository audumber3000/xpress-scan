import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  StatusBar,
  Dimensions,
  Platform,
  TextInput,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, Star, Shield, Layout, Users, BarChart3, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../../../shared/constants/colors';
import { showAlert } from '../../../../shared/components/alertService';
import { 
  CFErrorResponse, 
  CFPaymentGatewayService, 
} from 'react-native-cashfree-pg-sdk';
import { 
  CFEnvironment, 
  CFSession, 
} from 'cashfree-pg-api-contract';
import { paymentService } from '../services/PaymentService';
import { useAuth } from '../../../../app/AuthContext';

const { width } = Dimensions.get('window');

interface PurchaseScreenProps {
  navigation: any;
}

export const PurchaseScreen: React.FC<PurchaseScreenProps> = ({ navigation }) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [promoCode, setPromoCode] = useState('');
  const [isPromoApplied, setIsPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [confettiParticles, setConfettiParticles] = useState<any[]>([]);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shineAnim = useRef(new Animated.Value(0)).current;

  const { refreshBackendUser } = useAuth();

  useEffect(() => {
    // Setup Cashfree Callbacks
    CFPaymentGatewayService.setCallback({
      onVerify: async (orderID: string) => {
        console.log('✅ Payment Verification Triggered for:', orderID);
        try {
          const verifyRes = await paymentService.verifyPaymentStatus(orderID);
          if (verifyRes.success) {
            triggerConfetti();
            triggerPulse();
            await refreshBackendUser();
            showAlert('Success', 'Subscription activated successfully! Welcome to MolarPlus Pro.');
            navigation.goBack();
          } else {
            showAlert('Payment Pending', 'We are still waiting for payment confirmation. If the amount was debited, it will reflect within 24 hours.');
          }
        } catch (error) {
          console.error('Verification error:', error);
          showAlert('Error', 'Payment completed but verification failed. Please contact support.');
        } finally {
          setIsPaymentLoading(false);
        }
      },
      onError: (error: CFErrorResponse, orderID: string) => {
        console.log('❌ Payment Error:', error, 'Order:', orderID);
        setIsPaymentLoading(false);
        const errorMessage = (error as any).message || 'Something went wrong during payment.';
        if (errorMessage !== 'Payment cancelled') {
          showAlert('Payment Failed', errorMessage);
        }
      },
    });

    return () => {
      CFPaymentGatewayService.removeCallback();
    };
  }, []);

  useEffect(() => {
    if (isPromoApplied) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.delay(1000),
        ])
      ).start();
    }
  }, [isPromoApplied]);

  const baseMonthly = 1200;
  const baseYearly = 10800;

  const triggerConfetti = () => {
    const particles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      anim: new Animated.Value(0),
      startX: Math.random() * width,
      color: '#10B981',
      size: Math.random() * 8 + 4,
    }));
    
    setConfettiParticles(particles);

    const animations = particles.map(p => 
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 1500 + Math.random() * 1000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start(() => setConfettiParticles([]));
  };

  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === 'MOLAR20') {
      setIsPromoApplied(true);
      setPromoError('');
      triggerConfetti();
      triggerPulse();
    } else {
      setIsPromoApplied(false);
      setPromoError('Invalid promo code');
    }
  };

  const getDiscountedPrice = (price: number) => {
    return isPromoApplied ? Math.floor(price * 0.8) : price;
  };

  const features = [
    { id: 1, text: 'Digital Consent & WhatsApp Reminders', icon: Users },
    { id: 2, text: 'Multi-Branch & Staff Management', icon: Layout },
    { id: 3, text: 'Inventory & Vendor System', icon: Shield },
    { id: 4, text: '24/7 Support & Advanced Analytics', icon: BarChart3 },
  ];

  const handlePayment = async () => {
    try {
      setIsPaymentLoading(true);
      
      const planName = selectedPlan === 'monthly' ? 'professional' : 'professional_yearly';
      const checkoutRes = await paymentService.createCheckoutSession(planName, isPromoApplied ? promoCode : undefined);
      
      console.log('🚀 Initiating Cashfree Checkout:', checkoutRes.order_id);
      
      const session = new CFSession(
        checkoutRes.payment_session_id,
        checkoutRes.order_id,
        CFEnvironment.PRODUCTION
      );

      // Launch Web Checkout (Simplified for cross-platform)
      CFPaymentGatewayService.doWebPayment(session);
      
    } catch (error: any) {
      setIsPaymentLoading(false);
      console.error('Payment initiation failed:', error);
      showAlert('Error', error.message || 'Failed to start checkout. Please check your internet connection.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* 1. Header Hero Image */}
      <View style={styles.heroContainer}>
        <Image 
          source={require('../../../../../assets/dental_hero.png')} 
          style={styles.heroImage}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'transparent', '#FFFFFF']}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Back Button */}
        <SafeAreaView style={styles.backButtonContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Product Title & Badge */}
        <View style={styles.headerInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.brandName}>MolarPlus</Text>
            <View style={styles.proBadge}>
              <Star size={12} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.proBadgeText}>Pro</Text>
            </View>
          </View>
          <Text style={styles.tagline}>Unlock the full potential of your clinic.</Text>
        </View>

        {/* 3. Feature List */}
        <View style={styles.featuresList}>
          {features.map((feature) => (
            <View key={feature.id} style={styles.featureItem}>
              <View style={styles.checkCircle}>
              <Check size={14} color="#2E2A85" strokeWidth={3} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* 4. Plan Selection */}
        <Animated.View style={[styles.plansContainer, { transform: [{ scale: pulseAnim }] }]}>
          {/* Monthly Plan */}
          <TouchableOpacity 
            style={[
              styles.planCard, 
              selectedPlan === 'monthly' && styles.planCardSelected
            ]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.9}
          >
            <View style={[
              styles.planRadio, 
              selectedPlan === 'monthly' && styles.planRadioSelected
            ]}>
              {selectedPlan === 'monthly' && <View style={styles.planRadioInner} />}
            </View>
            <View style={styles.planDetails}>
              <Text style={styles.planTitle}>Monthly Subscription</Text>
              <Text style={styles.planSubtext}>₹1,200 / billed monthly</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.priceAmount}>
                {getDiscountedPrice(baseMonthly).toLocaleString()}
              </Text>
              {isPromoApplied && (
                <Text style={styles.originalPriceStrikethrough}>₹1,200</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Yearly Plan */}
          <TouchableOpacity 
            style={[
              styles.planCard, 
              selectedPlan === 'yearly' && styles.planCardSelected
            ]}
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.9}
          >
            <View style={[
              styles.planRadio, 
              selectedPlan === 'yearly' && styles.planRadioSelected
            ]}>
              {selectedPlan === 'yearly' && <View style={styles.planRadioInner} />}
            </View>
            <View style={styles.planDetails}>
              <View style={styles.row}>
                <Text style={styles.planTitle}>Yearly Subscription</Text>
                <View style={[styles.saveBadge, isPromoApplied && { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.saveBadgeText}>{isPromoApplied ? 'PROMO APPLIED' : 'SAVE 25%'}</Text>
                </View>
              </View>
              <Text style={styles.planSubtext}>₹{getDiscountedPrice(baseYearly).toLocaleString()} / billed annually</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.priceAmount}>
                {getDiscountedPrice(baseYearly).toLocaleString()}
              </Text>
              {isPromoApplied && (
                <Text style={styles.originalPriceStrikethrough}>₹10,800</Text>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* 4.5 Promo Code Section */}
        <View style={styles.promoContainer}>
          <View style={[styles.promoInputWrapper, !!promoError && styles.promoInputError]}>
            <TextInput
              style={styles.promoInput}
              placeholder="Promo Code"
              placeholderTextColor="#94A3B8"
              value={promoCode}
              onChangeText={(txt) => {
                setPromoCode(txt);
                if (promoError) setPromoError('');
              }}
              autoCapitalize="characters"
              editable={!isPromoApplied}
            />
            <TouchableOpacity 
              style={[styles.applyButton, isPromoApplied && styles.applyButtonDisabled]} 
              onPress={handleApplyPromo}
              disabled={isPromoApplied || !promoCode}
            >
              <Text style={styles.applyButtonText}>{isPromoApplied ? 'Applied' : 'Apply'}</Text>
            </TouchableOpacity>
          </View>
          {!!promoError && <Text style={styles.errorText}>{promoError}</Text>}
          {isPromoApplied && (
            <Text style={styles.promoSuccessText}>You're saving extra with MOLAR20!</Text>
          )}
        </View>

        {/* 5. Action Button */}
        <TouchableOpacity 
          style={[styles.buyButton, isPaymentLoading && { opacity: 0.7 }]} 
          activeOpacity={0.8}
          onPress={handlePayment}
          disabled={isPaymentLoading}
        >
          <LinearGradient
            colors={isPromoApplied ? ['#10B981', '#059669'] : ['#2E2A85', '#4338CA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.buyButtonText}>
              {isPaymentLoading 
                ? 'Processing...' 
                : (selectedPlan === 'monthly' ? 'Activate Monthly Plan' : 'Activate Yearly Plan')
              }
            </Text>
            
            {isPromoApplied && (
              <Animated.View 
                pointerEvents="none"
                style={[
                  styles.shineEffect,
                  {
                    transform: [{
                      translateX: shineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-width, width],
                      })
                    }]
                  }
                ]} 
              >
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* 6. Legal Footer */}
        <View style={styles.legalLinks}>
          <TouchableOpacity><Text style={styles.legalText}>Privacy Policy</Text></TouchableOpacity>
          <View style={styles.legalDot} />
          <TouchableOpacity><Text style={styles.legalText}>Terms of Service</Text></TouchableOpacity>
          <View style={styles.legalDot} />
          <TouchableOpacity><Text style={styles.legalText}>How to cancel?</Text></TouchableOpacity>
        </View>

        <Text style={styles.autoRenewText}>
          Subscription will automatically renew at the end of every period. You can cancel anytime from your clinic settings.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confetti Overlay */}
      <View pointerEvents="none" style={styles.confettiContainer}>
        {confettiParticles.map(p => (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                backgroundColor: p.color,
                width: p.size,
                height: p.size,
                transform: [
                  {
                    translateX: p.startX,
                  },
                  {
                    translateY: p.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [Dimensions.get('window').height + 50, -100],
                    }),
                  },
                  {
                    translateX: p.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (Math.random() - 0.5) * 200], // Drift
                    }),
                  },
                  {
                    rotate: p.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '720deg'],
                    }),
                  },
                  {
                    scale: p.anim.interpolate({
                      inputRange: [0, 0.8, 1],
                      outputRange: [0, 1.2, 0],
                    }),
                  },
                ],
                opacity: p.anim.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 1, 1, 0],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  heroContainer: {
    height: width * 0.55, // Reduced from 0.9
    width: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginTop: -80, // More overlap
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24, // Reduced from 32
  },
  headerInfo: {
    marginBottom: 16, // Reduced from 24
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700', // Gold Badge
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  proBadgeText: {
    color: '#1E1B4B', // Dark text on gold
    fontSize: 12,
    fontWeight: 'bold',
  },
  tagline: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  featuresList: {
    marginBottom: 20, // Reduced from 32
    gap: 10, // Reduced from 16
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(46, 42, 133, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },
  plansContainer: {
    gap: 12, // Reduced from 16
    marginBottom: 20, // Reduced from 32
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16, // Reduced from 20
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#2E2A85',
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planRadioSelected: {
    borderColor: '#2E2A85',
  },
  planRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2E2A85',
  },
  planDetails: {
    flex: 1,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  planSubtext: {
    fontSize: 13,
    color: '#64748B',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1B4B',
    marginTop: 2,
  },
  priceAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBadge: {
    backgroundColor: '#10B981', // Green for savings
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  buyButton: {
    marginBottom: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  gradientButton: {
    paddingVertical: 18,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Required for shine effect
  },
  shineEffect: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    zIndex: 1,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    zIndex: 2, // Keep text on top of shine
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  legalText: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
  legalDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  autoRenewText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  promoContainer: {
    marginBottom: 24,
  },
  promoInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  promoInputError: {
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  promoInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  applyButton: {
    backgroundColor: '#2E2A85',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyButtonDisabled: {
    backgroundColor: '#10B981',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  promoSuccessText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },
  originalPriceStrikethrough: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginLeft: 4,
    marginTop: 8,
  },
  particle: {
    position: 'absolute',
    borderRadius: 2,
    zIndex: 9999,
    elevation: 0, // Removed to fix "black shadow"
    shadowOpacity: 0,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 250, // Keep container elevated to stay on top
  },
});
