import fs from 'fs';
import path from 'path';

/**
 * There must be no way to buy a subscription from the app, on either platform.
 *
 * This is a source-level guard rather than a behavioural test on purpose. What
 * it protects against is somebody reintroducing a checkout, a promo field or a
 * tappable "upgrade on the web" link — none of which would fail a render test,
 * and any of which costs an App Store rejection and a release cycle.
 *
 * Apple 3.1.1 forbids a sign-in-only client from steering users to an external
 * purchase. Naming the website is a statement of fact and is allowed; making it
 * tappable is a call to action and is not. WhatsApp support IS allowed to be
 * tappable, because customer support is not a purchasing mechanism.
 */

const SRC = path.join(__dirname, '..', 'src');

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });

const read = (f: string) => fs.readFileSync(f, 'utf8');
const rel = (f: string) => path.relative(SRC, f);

/**
 * Lines of actual code, with comments dropped.
 *
 * The guards below look for `Linking.openURL`, and the files they check
 * deliberately EXPLAIN in prose why they do not call it. Matching that prose
 * failed the build for saying the right thing, which is the worst kind of test.
 */
const codeLines = (body: string) =>
  body
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });

describe('no purchase surface in the app', () => {
  const subscriptionFiles = walk(path.join(SRC, 'features', 'admin', 'subscription'));

  it('has subscription screens to check', () => {
    expect(subscriptionFiles.length).toBeGreaterThan(0);
  });

  it('never initialises a payment SDK for a subscription', () => {
    subscriptionFiles.forEach((f) => {
      const body = read(f);
      expect(`${rel(f)}: ${/CFPaymentGatewayService|cashfree-pg|CFSession/.test(body)}`)
        .toBe(`${rel(f)}: false`);
    });
  });

  it('never offers a promo code on the phone', () => {
    subscriptionFiles.forEach((f) => {
      expect(`${rel(f)}: ${/promoCode|promo_code/i.test(read(f))}`)
        .toBe(`${rel(f)}: false`);
    });
  });

  it('only ever opens WhatsApp support, never a purchase page', () => {
    subscriptionFiles.forEach((f) => {
      codeLines(read(f))
        .filter((l) => l.includes('Linking.openURL'))
        .forEach((line) => {
          expect(`${rel(f)} :: ${line.trim()}`).toContain('wa.me');
        });
    });
  });

  it('keeps the marketing site out of every link and button, app-wide', () => {
    // MARKETING_SITE_TEXT is a string for copy. If it ever ends up inside an
    // openURL or an href it has become a call to action.
    //
    // Scoped to the WEB address specifically. `mailto:support@molarplus.com` in
    // the help screen is a support contact, not a storefront, and the point of
    // this test is the storefront.
    const WEB_ADDRESS = /(https?:\/\/|www\.)([\w-]+\.)*molarplus\.com/;

    walk(SRC).forEach((f) => {
      codeLines(read(f))
        .filter((l) => /Linking\.openURL|href=/.test(l))
        .forEach((line) => {
          expect(`${rel(f)} :: ${line.trim()}`).not.toContain('MARKETING_SITE_TEXT');
          expect(`${rel(f)} :: ${line.trim()}`).not.toMatch(WEB_ADDRESS);
        });
    });
  });

  it('has the purchase flag off for everyone, not just iOS', () => {
    const platform = read(path.join(SRC, 'shared', 'constants', 'platform.ts'));
    expect(platform).toMatch(/export const IS_PURCHASE_UI_ENABLED = false;/);
  });
});
