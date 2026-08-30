/**
 * Checks for the treatment shortlists and the safety rails.
 *
 *   node frontend/src/components/patient/derm/dermProtocols.check.mjs
 *
 * A plain node script rather than a test file because the frontend has no test
 * runner configured (package.json has dev, build, lint and preview, and that is
 * all). This is the one piece of derm logic where being wrong is not a cosmetic
 * problem — a pregnancy flag that fails to fire on isotretinoin is a real
 * safety miss — so it gets checked even without a harness to hang it on.
 *
 * Pure data and pure functions, no React, so it runs under node directly.
 */
import {
  CONDITIONS, CONDITIONS_BY_ID, activeSafetyFlags, warningsFor, sessionDefaultFor,
} from './dermProtocols.js';

let fail = 0;
const ok = (name, cond) => { console.log(`${cond ? '  ok ' : ' FAIL'}  ${name}`); if (!cond) fail++; };

console.log('\n— shape —');
ok(`${CONDITIONS.length} conditions defined`, CONDITIONS.length >= 12);
ok('every condition has assess fields', CONDITIONS.every((c) => c.assess?.length >= 2));
ok('every condition has plan groups', CONDITIONS.every((c) => c.plan?.length >= 1));
ok('every plan item has a label', CONDITIONS.every((c) =>
  c.plan.every((g) => g.items.every((i) => typeof i.label === 'string' && i.label))));
ok('ids are unique', new Set(CONDITIONS.map((c) => c.id)).size === CONDITIONS.length);

console.log('\n— the wall-of-chips fix: how many options per condition —');
for (const c of CONDITIONS.slice(0, 4)) {
  const n = c.assess.reduce((a, f) => a + (f.options?.length || 1), 0);
  console.log(`  ${c.label.padEnd(20)} ${String(n).padStart(3)} options across ${c.assess.length} fields`);
}

console.log('\n— safety: pregnant patient —');
const pregnant = { fitzpatrick: 'III', menstrualStatus: 'Pregnant', pastTreatments: [] };
const pf = activeSafetyFlags(pregnant).map((f) => f.id);
ok('pregnancy flag fires', pf.includes('pregnancy'));
ok('darkskin flag does not', !pf.includes('darkskin'));
const iso = CONDITIONS_BY_ID.acne.plan.flatMap((g) => g.items)
  .find((i) => i.label === 'Oral isotretinoin');
ok('isotretinoin is marked for a pregnant patient', warningsFor(iso, pf).includes('pregnancy'));
const bpo = CONDITIONS_BY_ID.acne.plan.flatMap((g) => g.items)
  .find((i) => i.label === 'Benzoyl peroxide');
ok('benzoyl peroxide is NOT marked', warningsFor(bpo, pf).length === 0);

console.log('\n— safety: Fitzpatrick V —');
const dark = { fitzpatrick: 'V', menstrualStatus: 'Postmenopausal', pastTreatments: [] };
const df = activeSafetyFlags(dark).map((f) => f.id);
ok('darkskin flag fires', df.includes('darkskin'));
ok('pregnancy flag does not', !df.includes('pregnancy'));
ok('finasteride flag does not for postmenopausal', !df.includes('finasteride'));
const hq = CONDITIONS_BY_ID.melasma.plan.flatMap((g) => g.items)
  .find((i) => i.label.startsWith('Hydroquinone'));
ok('hydroquinone marked on dark skin', warningsFor(hq, df).includes('darkskin'));
const sunscreen = CONDITIONS_BY_ID.melasma.plan.flatMap((g) => g.items)
  .find((i) => i.label.startsWith('Broad-spectrum sunscreen'));
ok('sunscreen never marked', warningsFor(sunscreen, df).length === 0);

console.log('\n— safety: self-prescribed steroid —');
const steroid = { fitzpatrick: 'IV', menstrualStatus: '', pastTreatments: ['Topical steroid (self-prescribed)'] };
ok('steroid-misuse flag fires', activeSafetyFlags(steroid).map((f) => f.id).includes('steroidmisuse'));

console.log('\n— safety: woman of childbearing potential —');
const wcbp = { fitzpatrick: 'IV', menstrualStatus: 'Regular cycles', pastTreatments: [] };
ok('finasteride flag fires', activeSafetyFlags(wcbp).map((f) => f.id).includes('finasteride'));

console.log('\n— sessions —');
ok('peel proposes a course', sessionDefaultFor('Glycolic acid peel 20–35%')?.sessions === 6);
ok('QS Nd:YAG proposes a course', sessionDefaultFor('Low-fluence Q-switched Nd:YAG (laser toning)')?.intervalDays === 14);
ok('a tablet proposes none', sessionDefaultFor('Oral doxycycline') === null);

console.log(fail ? `\n${fail} FAILED\n` : '\nall checks passed\n');
process.exit(fail ? 1 : 0);
