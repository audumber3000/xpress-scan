// Expo config plugin: enable CocoaPods modular headers for the Firebase
// transitive pods that don't define modules.
//
// Why: `AppCheckCore` (pulled in transitively by Firebase/GoogleSignIn) is a
// Swift pod that depends on `GoogleUtilities` and `RecaptchaInterop`. When those
// are built as static libraries without module maps, `pod install` fails with:
//   "[!] The following Swift pods cannot yet be integrated as static libraries"
// EAS regenerates ios/ on every build, so the fix has to live in the JS config
// (not the gitignored ios/Podfile). This injects `:modular_headers => true` for
// the affected pods, which is CocoaPods' recommended targeted fix.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULAR_PODS = ['GoogleUtilities', 'RecaptchaInterop'];

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      const inject = MODULAR_PODS
        .filter((p) => !contents.includes(`pod '${p}', :modular_headers => true`))
        .map((p) => `  pod '${p}', :modular_headers => true`)
        .join('\n');

      if (inject) {
        // Insert right after `use_expo_modules!` inside the app target.
        contents = contents.replace(
          /(\n[ \t]*use_expo_modules!.*\n)/,
          `$1${inject}\n`,
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
