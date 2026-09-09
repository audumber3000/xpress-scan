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
const processor = postcss([
  oklabFunction({ preserve: true }),
  colorMixFunction({ preserve: true }),
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
