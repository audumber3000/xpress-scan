// BDent License & Trial Management
// Handles 14-day trial and license activation

const TRIAL_DAYS = 14;
const LICENSE_STORAGE_KEY = 'bdent_license';
const TRIAL_START_KEY = 'bdent_trial_start';

// Get trial start date from localStorage
export const getTrialStartDate = () => {
  const stored = localStorage.getItem(TRIAL_START_KEY);
  if (stored) {
    return new Date(stored);
  }
  return null;
};

// Start trial (called on first app launch)
export const startTrial = () => {
  const existing = getTrialStartDate();
  if (!existing) {
    const now = new Date();
    localStorage.setItem(TRIAL_START_KEY, now.toISOString());
    return now;
  }
  return existing;
};

// Get days remaining in trial
export const getTrialDaysRemaining = () => {
  const startDate = getTrialStartDate();
  if (!startDate) {
    return TRIAL_DAYS; // Trial not started yet
  }
  
  const now = new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const remaining = TRIAL_DAYS - diffDays;
  
  return Math.max(0, remaining);
};

// Check if trial is expired
export const isTrialExpired = () => {
  return getTrialDaysRemaining() <= 0;
};

// Check if trial is active
export const isTrialActive = () => {
  const startDate = getTrialStartDate();
  if (!startDate) return false;
  return !isTrialExpired();
};

// License structure
// {
//   key: string,
//   clinicName: string,
//   plan: 'desktop' | 'desktop_cloud' | 'cloud',
//   activatedAt: string (ISO date),
//   expiresAt: string (ISO date) | null (lifetime),
//   amcExpiresAt: string (ISO date) | null
// }

// Get stored license
export const getLicense = () => {
  const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  }
  return null;
};

// Validate license key format (simple validation)
// Format: BDENT-XXXX-XXXX-XXXX
export const validateLicenseKeyFormat = (key) => {
  const pattern = /^BDENT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key.toUpperCase());
};

// Activate license (in real app, this would validate with server)
export const activateLicense = async (licenseKey, clinicName) => {
  // Validate format
  if (!validateLicenseKeyFormat(licenseKey)) {
    throw new Error('Invalid license key format');
  }
  
  // In production, you would validate with your server here
  // For now, we'll accept any correctly formatted key
  
  const license = {
    key: licenseKey.toUpperCase(),
    clinicName: clinicName,
    plan: 'desktop', // Default plan
    activatedAt: new Date().toISOString(),
    expiresAt: null, // Lifetime license
    amcExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year AMC
  };
  
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license));
  return license;
};

// Check if license is valid
export const isLicenseValid = () => {
  const license = getLicense();
  if (!license) return false;
  
  // Check if license has expired (for subscription plans)
  if (license.expiresAt) {
    const expiryDate = new Date(license.expiresAt);
    if (new Date() > expiryDate) {
      return false;
    }
  }
  
  return true;
};

// Check if AMC is active
export const isAmcActive = () => {
  const license = getLicense();
  if (!license || !license.amcExpiresAt) return false;
  
  const amcExpiry = new Date(license.amcExpiresAt);
  return new Date() <= amcExpiry;
};

// Get AMC days remaining
export const getAmcDaysRemaining = () => {
  const license = getLicense();
  if (!license || !license.amcExpiresAt) return 0;
  
  const amcExpiry = new Date(license.amcExpiresAt);
  const now = new Date();
  const diffTime = amcExpiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Get overall app status
export const getAppStatus = () => {
  const license = getLicense();
  
  if (license && isLicenseValid()) {
    return {
      status: 'licensed',
      plan: license.plan,
      clinicName: license.clinicName,
      amcActive: isAmcActive(),
      amcDaysRemaining: getAmcDaysRemaining(),
    };
  }
  
  const trialStart = getTrialStartDate();
  if (trialStart) {
    const daysRemaining = getTrialDaysRemaining();
    if (daysRemaining > 0) {
      return {
        status: 'trial',
        daysRemaining: daysRemaining,
        trialStartDate: trialStart,
      };
    } else {
      return {
        status: 'expired',
        message: 'Your trial has expired. Please purchase a license to continue.',
      };
    }
  }
  
  return {
    status: 'new',
    message: 'Start your 14-day free trial',
  };
};

// Clear all license data (for testing)
export const clearLicenseData = () => {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  localStorage.removeItem(TRIAL_START_KEY);
};
