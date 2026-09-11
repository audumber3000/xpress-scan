/**
 * A calibration sheet for pre-printed letterheads.
 *
 * Setting up letterhead mode means knowing how much blank space your stationery
 * leaves on each of the four edges, in millimetres. Nobody can guess that, and
 * guessing costs a sheet of headed paper per attempt — which is exactly what
 * the dentist who reported this was doing.
 *
 * So: print this on a PLAIN page, hold it against the letterhead, and read the
 * number nearest where the printing stops on each edge.
 *
 * Printed at true scale. `@page { size: A4; margin: 0 }` plus millimetre units
 * means 10mm on screen is 10mm on paper, which is the entire point — the
 * browser's default margins would shift every reading. The clinic must also
 * have "fit to page" / scaling off, which the sheet says on its face, because a
 * scaled print silently makes every number wrong.
 */

const TICKS = (mm, vertical) => {
  let out = '';
  for (let n = 0; n <= mm; n += 5) {
    const major = n % 10 === 0;
    const pos = `${n}mm`;
    const len = major ? 6 : 3;
    out += vertical
      ? `<div class="tick" style="top:${pos};width:${len}mm"></div>`
        + (major && n > 0 ? `<div class="num" style="top:calc(${pos} - 2mm);left:${len + 1}mm">${n}</div>` : '')
      : `<div class="tick v" style="left:${pos};height:${len}mm"></div>`
        + (major && n > 0 ? `<div class="num" style="left:calc(${pos} - 3mm);top:${len + 1}mm">${n}</div>` : '');
  }
  return out;
};

export function printLetterheadRuler() {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>Letterhead test sheet</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; }
  .sheet { position: relative; width: 210mm; height: 297mm; overflow: hidden; }
  .tick { position: absolute; left: 0; height: 0; border-top: 0.3mm solid #111; }
  .tick.v { top: 0; width: 0; border-top: 0; border-left: 0.3mm solid #111; }
  .num { position: absolute; font-size: 7pt; color: #111; }
  .edge { position: absolute; }
  .edge.top    { top: 0; left: 0; width: 100%; }
  .edge.bottom { bottom: 0; left: 0; width: 100%; transform: scaleY(-1); }
  .edge.left   { top: 0; left: 0; height: 100%; }
  .edge.right  { top: 0; right: 0; height: 100%; transform: scaleX(-1); }
  /* The flip that mirrors those two rulers mirrors their digits too, and a
     sheet whose whole job is to be read must not print its numbers backwards.
     Counter-flipping each label about its own centre leaves the tick positions
     alone and turns the glyphs back the right way round. */
  .edge.bottom .num { transform: scaleY(-1); }
  .edge.right .num  { transform: scaleX(-1); }
  .label { position: absolute; font-size: 9pt; font-weight: 700; color: #111; letter-spacing: .5px; }
  .mid { position: absolute; top: 105mm; left: 0; width: 100%; text-align: center; padding: 0 30mm; }
  .mid h1 { font-size: 13pt; margin: 0 0 4mm; }
  .mid p { font-size: 9.5pt; line-height: 1.5; color: #333; margin: 0 0 3mm; }
  .warn { font-size: 9pt; font-weight: 700; color: #b45309; }
</style></head><body>
<div class="sheet">
  <div class="edge top">${TICKS(120, true)}<div class="label" style="top:2mm;left:40mm">TOP &darr; millimetres from the edge</div></div>
  <div class="edge bottom">${TICKS(120, true)}</div>
  <div class="edge left">${TICKS(120, false)}</div>
  <div class="edge right">${TICKS(120, false)}</div>

  <div class="mid">
    <h1>Letterhead test sheet</h1>
    <p>Print this on a <strong>plain sheet</strong>, then hold it against your letterhead.</p>
    <p>On each edge, read the number nearest where your pre-printed design stops.
       Those four numbers go into the letterhead settings.</p>
    <p class="warn">Print at 100% &mdash; turn off &ldquo;Fit to page&rdquo; or any scaling,
       or every measurement will be wrong.</p>
    <p style="font-size:8.5pt;color:#666;">Bottom and right are measured inward from their own edge.</p>
  </div>
</div>
${'<scr' + 'ipt>window.onload=function(){window.print();};</scr' + 'ipt>'}
</body></html>`);
  w.document.close();
  return true;
}
