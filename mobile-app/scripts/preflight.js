/**
 * Pre-flight checks for MolarPlus Mobile App
 * Runs before build/release to ensure everything is configured correctly.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

let errorCount = 0;

function log(type, msg) {
  switch (type) {
    case 'ok': console.log(`  ${COLORS.green}✅ ${msg}${COLORS.reset}`); break;
    case 'error': 
      console.log(`  ${COLORS.red}❌ ${msg}${COLORS.reset}`); 
      errorCount++;
      break;
    case 'warn': console.log(`  ${COLORS.yellow}⚠️  ${msg}${COLORS.reset}`); break;
    case 'header': console.log(`\n${COLORS.blue}=== ${msg} ===${COLORS.reset}\n`); break;
  }
}

log('header', 'MolarPlus Mobile — Pre-flight Checks');

// 1. Check Version Consistency
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  
  const pkgVersion = packageJson.version;
  const expoVersion = appJson.expo.version;

  if (pkgVersion === expoVersion) {
    log('ok', `Versions synchronized: ${pkgVersion}`);
  } else {
    log('error', `Version mismatch: package.json (${pkgVersion}) vs app.json (${expoVersion})`);
  }
} catch (e) {
  log('error', `Failed to read config files: ${e.message}`);
}

// 2. Check Environment Variables
try {
  const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  
  const productionUrl = "https://api.molarplus.com";
  const nexusUrl = "https://nexus.molarplus.com";

  if (envContent.includes(`EXPO_PUBLIC_API_URL=${productionUrl}`)) {
    log('ok', `API URL points to production: ${productionUrl}`);
  } else {
    log('error', `API URL is NOT pointing to production! Check .env`);
  }

  if (envContent.includes(`EXPO_PUBLIC_NEXUS_API_URL=${nexusUrl}`)) {
    log('ok', `Nexus URL points to production: ${nexusUrl}`);
  } else {
    log('warn', `Nexus URL is not pointing to production. (Found in .env)`);
  }
} catch (e) {
  log('error', `Failed to read .env file: ${e.message}`);
}

// 3. Check Android Config
try {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  const packageName = appJson.expo.android.package;
  
  if (packageName === 'com.molarplus.app') {
    log('ok', `Android package name correct: ${packageName}`);
  } else {
    log('error', `Wrong Android package name: ${packageName} (Expected com.molarplus.app)`);
  }
} catch (e) {
  log('error', `Failed to validate Android config: ${e.message}`);
}

// 4. Check Key Assets
const requiredAssets = [
  'assets/icon.png',
  'assets/splashscreen.png',
  'assets/adaptive-icon.png',
];

requiredAssets.forEach(asset => {
  if (fs.existsSync(path.join(ROOT, asset))) {
    log('ok', `Found asset: ${asset}`);
  } else {
    log('error', `MISSING asset: ${asset}`);
  }
});

// Final Result
console.log('\n========================================');
if (errorCount > 0) {
  console.log(`  ${COLORS.red}PRE-FLIGHT FAILED — ${errorCount} error(s)${COLORS.reset}`);
  console.log('========================================\n');
  process.exit(1);
} else {
  console.log(`  ${COLORS.green}ALL CHECKS PASSED — App is ready to build!${COLORS.reset}`);
  console.log('========================================\n');
  process.exit(0);
}
