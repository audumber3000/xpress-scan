import { Platform } from 'react-native';

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

// App Store guideline 3.1.1 / 3.1.3(b): the iOS build is a sign-in-only client
// for clinics that subscribed and onboarded on the web. Anything that would
// expose an in-app purchase, promo code, or new-clinic registration mechanism
// must be gated behind this flag. Do not relax it without re-reading the
// rejection notes in docs/ios-app-review.md.
export const IS_PURCHASE_UI_ENABLED = !IS_IOS;
export const IS_SIGNUP_ENABLED = !IS_IOS;

// Public-facing website used in iOS sign-in screen copy. Must not be wrapped
// in a tappable link/button on iOS — Apple forbids any CTA that could be read
// as steering users to an external purchasing mechanism.
export const MARKETING_SITE_TEXT = 'molarplus.com';
