// Build a copy of dist/ that renders the way Chrome 109 would.
//
// Chrome 109 is the last Chrome that Windows 7 and 8 can ever run — Google
// capped it in January 2023 — and it lacks oklch(), color-mix() and the
// `in oklab` gradient interpolation Tailwind v4 emits by default. It skips the
// @supports blocks that carry those, falling back to whatever the base
// declarations say.
//
// This deletes exactly those blocks, so opening the result in a MODERN browser
// shows the fallback rendering: the same thing Chrome 109 gets. It is a CSS
// simulation only — it says nothing about JavaScript behaviour — but the
// reported bug (a sidebar with no background) is entirely a CSS one.
import { cp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'dist');
const out = path.join(root, 'dist-chrome109');

// Conditions Chrome 109 answers "no" to.
//
// `oklab` needs the bare word, not "in oklab": the @csstools plugin guards its
// upgrades with `@supports (color: oklab(0% 0 0%))`, and a first pass here that
// only looked for the gradient form left 155 oklch custom properties standing.
// That mattered, because a custom property accepts ANY token sequence at parse
// time — an unsupported oklch value does not get discarded the way a normal
// declaration would, it wins, and the var() using it then fails at
// computed-value time. Getting this list wrong makes the simulation lie in the
// dangerous direction.
//
// All of these are Chrome 111: oklab(), oklch(), lab(), lch(), color-mix(),
// display-p3, and gradient interpolation keywords.
const UNSUPPORTED = /oklch|oklab|color-mix|\blab\(|\blch\(|color\(display-p3/i;

await rm(out, { recursive: true, force: true });
await cp(src, out, { recursive: true });

const assets = path.join(out, 'assets');
let dropped = 0;
for (const file of (await readdir(assets)).filter((f) => f.endsWith('.css'))) {
  const p = path.join(assets, file);
  const root_ = postcss.parse(await readFile(p, 'utf8'), { from: p });
  root_.walkAtRules('supports', (rule) => {
    if (UNSUPPORTED.test(rule.params)) { rule.remove(); dropped += 1; }
  });
  await writeFile(p, root_.toString());
}
console.log(`[chrome109-preview] removed ${dropped} @supports block(s) Chrome 109 would skip`);
console.log(`[chrome109-preview] wrote ${out}`);
