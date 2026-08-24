import { Platform } from 'react-native';

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

/**
 * May the app charge for a subscription?
 *
 * **No, on either platform.** Plans are bought on the website.
 *
 * It used to be `!IS_IOS`, because only Apple forbade it. Android carried a
 * complete native Cashfree checkout, which sold a single ₹899 "professional"
 * plan — a product that stopped existing when the catalogue became
 * Plus / Pro / Growth. Keeping it would have meant two checkouts quoting
 * different prices, and the three-plan model, the GST line, the coupon terms
 * and the rule that an Indian clinic never sees a dollar figure would all have
 * had to be implemented twice.
 *
 * One checkout, on the web, is the whole reason this is now a constant `false`
 * rather than a platform test. Do not turn it back on for one platform.
 */
export const IS_PURCHASE_UI_ENABLED = false;

/**
 * May the app show what the OTHER plans cost?
 *
 * Android yes, iOS no. Reading your own plan is account information and is fine
 * everywhere; a price list for plans you cannot buy here reads as steering
 * towards an external purchase, which is what App Store guideline 3.1.1 is
 * about. iOS therefore sees its current plan and what that plan includes, and
 * is told plans are managed on the website — the Spotify shape.
 */
export const IS_PLAN_PRICING_VISIBLE = !IS_IOS;

/**
 * May somebody create a NEW clinic from the app?
 *
 * Android only. The iOS build is a sign-in-only client for clinics that
 * subscribed and onboarded on the web (guideline 3.1.3(b)), so there is no
 * signup there — and therefore no signup verification step to add to it.
 */
export const IS_SIGNUP_ENABLED = !IS_IOS;

// The public website, named in copy on both platforms. Must NEVER be wrapped in
// a link, a button, or anything else tappable: naming it is a statement of
// fact, making it tappable is a call to action steering to an external
// purchasing mechanism, and that is the thing that gets a build rejected.
export const MARKETING_SITE_TEXT = 'molarplus.com';

/**
 * Where the clinic app itself lives, for copy and for the clipboard.
 *
 * `MARKETING_SITE_TEXT` above is the brochure site; this is the thing you sign
 * in to, and it is the one somebody actually needs when they go to change their
 * plan. Telling them "molarplus.com" and letting them find their way to the
 * login is a step we can save them.
 *
 * Copying is not opening. A copied string sits on the clipboard until the
 * person chooses to paste it, which is them navigating, not us steering them.
 * Passing either of these to `Linking.openURL` would be the other thing, and
 * `__tests__/noPurchaseSurface.test.ts` fails the build if anyone does.
 */
export const WEB_APP_HOST = 'app.molarplus.com';
export const WEB_SUBSCRIPTION_URL = `https://${WEB_APP_HOST}/admin/subscription`;
