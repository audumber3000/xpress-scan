import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-toastify';
import { auth } from '../firebaseClient';
import { api } from './api';
import { saveLastLogin } from './lastLogin';

const PENDING_KEY = 'molarplus_google_redirect_pending';

export const markGoogleRedirectPending = (mode) => {
  sessionStorage.setItem(PENDING_KEY, mode);
};

export const hasGoogleRedirectPending = () => {
  return !!sessionStorage.getItem(PENDING_KEY);
};

export const clearGoogleRedirectPending = () => {
  sessionStorage.removeItem(PENDING_KEY);
};

export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isDesktop = /Windows|Mac|Linux/.test(userAgent) && !isMobile;

  let deviceType = 'web';
  let devicePlatform = 'Unknown';
  let deviceOS = '';

  if (isMobile) {
    deviceType = 'mobile';
    if (/Android/i.test(userAgent)) {
      devicePlatform = 'Android';
      const androidVersion = userAgent.match(/Android\s([0-9.]*)/);
      deviceOS = androidVersion ? `Android ${androidVersion[1]}` : 'Android';
    } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
      devicePlatform = 'iOS';
      const iosVersion = userAgent.match(/OS\s([0-9_]*)/);
      deviceOS = iosVersion ? `iOS ${iosVersion[1].replace('_', '.')}` : 'iOS';
    }
  } else if (isDesktop) {
    deviceType = 'desktop';
    if (/Windows/i.test(userAgent)) {
      devicePlatform = 'Windows';
      const winVersion = userAgent.match(/Windows NT\s([0-9.]*)/);
      deviceOS = winVersion ? `Windows ${winVersion[1]}` : 'Windows';
    } else if (/Mac/i.test(userAgent)) {
      devicePlatform = 'macOS';
      const macVersion = userAgent.match(/Mac OS X\s([0-9_]*)/);
      deviceOS = macVersion ? `macOS ${macVersion[1].replace('_', '.')}` : 'macOS';
    } else if (/Linux/i.test(userAgent)) {
      devicePlatform = 'Linux';
      deviceOS = 'Linux';
    }
  }

  return {
    device_type: deviceType,
    device_platform: devicePlatform,
    device_os: deviceOS,
    device_name: `${devicePlatform} ${deviceType === 'mobile' ? 'Device' : deviceType === 'desktop' ? 'Device' : 'Browser'}`,
    user_agent: userAgent,
  };
};

const waitForFirebaseUser = (timeoutMs = 5000) => {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(auth.currentUser);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (settled || !user) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
};

export const completeGoogleRedirectAuth = async ({
  navigate,
  setUser,
  setToken,
  setError,
  setLoading,
  referredBy,
  successMessage = 'Login successful!',
} = {}) => {
  if (!hasGoogleRedirectPending()) return false;

  setLoading?.(true);
  setError?.('');

  try {
    const result = await getRedirectResult(auth);
    const firebaseUser = result?.user || auth.currentUser || await waitForFirebaseUser();

    if (!firebaseUser) {
      throw new Error('No authentication result found. Please try logging in again.');
    }

    const idToken = await firebaseUser.getIdToken();
    const data = await api.post('/auth/oauth', {
      id_token: idToken,
      device: getDeviceInfo(),
      ...(referredBy && { referred_by_code: referredBy }),
    });

    const userWithClinic = data.clinic ? { ...data.user, clinic: data.clinic } : data.user;
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user', JSON.stringify(userWithClinic));

    setToken?.(data.token);
    setUser?.(userWithClinic);
    clearGoogleRedirectPending();
    sessionStorage.removeItem('referred_by_code');

    saveLastLogin({
      provider: 'google',
      email: firebaseUser.email,
      name: firebaseUser.displayName,
    });

    toast.success(successMessage);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const redirectPath = !data.user.clinic_id
      ? '/onboarding'
      : (data.user.role === 'clinic_owner' && data.user.clinics?.length > 1)
        ? '/select-clinic'
        : '/dashboard';

    navigate?.(redirectPath, { replace: true });
    return true;
  } catch (error) {
    clearGoogleRedirectPending();
    const errorMessage = error.response?.data?.detail || error.message || 'Google login failed. Please try again.';
    setError?.(errorMessage);
    toast.error(errorMessage);
    return true;
  } finally {
    setLoading?.(false);
  }
};
