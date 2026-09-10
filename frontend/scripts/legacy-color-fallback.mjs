// Runs after `vite build`. Adds rgb() fallbacks in front of every oklch()
// and color-mix() declaration in the built CSS, so a browser that can't
// parse them (anything before Chrome 111 — which includes every Chrome
// Windows 7 can ever run, since Google capped it at Chrome 109 in Jan
// 2023) keeps a real color instead of losing it silently.
//
// Why this runs as a separate pass instead of a plugin in postcss.config.cjs:
// Tailwind v4's PostCSS plugin resolves its utility classes and injects the
// generated CSS via a late-stage hook, after other plugins' declaration
// visitors have already swept past in the same single-pass walk — so a
// fallback plugin merely listed after it in that pipeline never actually
// sees Tailwind's oklch()/color-mix() output, regardless of array order.
// Once the build has finished and the CSS is a plain static file on disk,
// that's no longer an issue — it's just text at that point.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import oklabFunction from '@csstools/postcss-oklab-function';
import colorMixFunction from '@csstools/postcss-color-mix-function';

const distAssets = path.resolve(import.meta.dirname, '..', 'dist', 'assets');

// Tailwind v4 interpolates gradients in oklab by default, emitting
// `--tw-gradient-position: to bottom in oklab`. The colour-space keyword inside
// linear-gradient() is Chrome 111+, so on Chrome 109 the substituted
// background-image is invalid at computed-value time and the element ends up
// with NO background at all. On the sidebar — white text on a dark gradient —
// that reads as the whole component being broken, while pages of black-on-white
// text look fine. It is exactly the bug that was reported.
//
// The two plugins below cannot see this: it is not an oklch() or a color-mix(),
// it is a bare keyword inside a custom property, and a custom property accepts
// any value at parse time. So this pass strips the keyword for everyone and
// hands it back to browsers that can prove they support it.
//
// The @supports block is appended at the END of the file so it wins the
// cascade. Its condition is deliberately a real gradient rather than
// `(color: oklab(...))`: Chrome 109 supports the oklab() colour function while
// still rejecting the interpolation keyword, so testing the colour function
// would answer yes and reinstate the broken value.
const GRADIENT_SUPPORTS = '(background-image: linear-gradient(in oklab, red, blue))';

const liftOklabInterpolation = () => ({
  postcssPlugin: 'lift-oklab-interpolation',
  OnceExit(root, { Rule, AtRule, Declaration }) {
    const upgrades = [];

    root.walkDecls((decl) => {
      if (!decl.prop.startsWith('--') || !/\bin oklab\b/.test(decl.value)) return;
      const parent = decl.parent;
      if (!parent || parent.type !== 'rule') return;

      upgrades.push({ selector: parent.selector, prop: decl.prop, value: decl.value });
      decl.value = decl.value.replace(/\s*\bin oklab\b/g, '').trim();
    });

    if (upgrades.length === 0) return;

    const supports = new AtRule({ name: 'supports', params: GRADIENT_SUPPORTS });
    // One rule per selector, so a selector carrying two of these keeps both.
    const bySelector = new Map();
    for (const u of upgrades) {
      if (!bySelector.has(u.selector)) bySelector.set(u.selector, []);
      bySelector.get(u.selector).push(u);
    }
    for (const [selector, decls] of bySelector) {
      const rule = new Rule({ selector });
      for (const d of decls) rule.append(new Declaration({ prop: d.prop, value: d.value }));
      supports.append(rule);
    }
    root.append(supports);
    console.log(`[legacy-color-fallback] lifted ${upgrades.length} oklab gradient/shadow value(s) behind @supports`);
  },
});
liftOklabInterpolation.postcss = true;

const processor = postcss([
  oklabFunction({ preserve: true }),
  colorMixFunction({ preserve: true }),
  liftOklabInterpolation(),
]);

const files = (await readdir(distAssets)).filter((f) => f.endsWith('.css'));
if (files.length === 0) {
  console.warn(`[legacy-color-fallback] no CSS files found in ${distAssets} — did the build run?`);
}

for (const file of files) {
  const filePath = path.join(distAssets, file);
  const css = await readFile(filePath, 'utf8');
  const result = await processor.process(css, { from: filePath, to: filePath });
  await writeFile(filePath, result.css);
  console.log(`[legacy-color-fallback] added fallbacks to ${file}`);
}
