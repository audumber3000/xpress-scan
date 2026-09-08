/**
 * The dental chart, as a standalone SVG string for the PDF.
 *
 * The chart is drawn once, here in the browser, and the PDF embeds what the
 * doctor is actually looking at. The alternative was re-implementing all
 * seventeen symbols server-side against a copy of the tooth artwork, and two
 * renderers of the same picture drift — one gets a new symbol, the other does
 * not, and nobody notices until a chart and its PDF disagree in front of a
 * patient.
 *
 * The catch is that the live SVG is styled by Tailwind classes (`fill-white`,
 * `text-[13px]`, `font-black`). Those are stylesheet rules, and a serialised
 * node carries none of its stylesheet, so every letter would arrive at the PDF
 * renderer unstyled — black, default size, in the wrong place. So each node's
 * computed style is copied onto the clone as a plain SVG attribute before the
 * classes are dropped.
 */

/* Only what actually changes how a shape is painted. Copying everything
   getComputedStyle returns would produce a megabyte of noise per tooth. */
const PAINT_PROPS = [
    ['fill', 'fill'],
    ['stroke', 'stroke'],
    ['stroke-width', 'strokeWidth'],
    ['stroke-linecap', 'strokeLinecap'],
    ['stroke-linejoin', 'strokeLinejoin'],
    ['stroke-dasharray', 'strokeDasharray'],
    ['opacity', 'opacity'],
];

const TEXT_PROPS = [
    ['font-size', 'fontSize'],
    ['font-weight', 'fontWeight'],
    ['font-family', 'fontFamily'],
    ['text-anchor', 'textAnchor'],
    ['letter-spacing', 'letterSpacing'],
];

/**
 * Serialise the dental chart currently on screen.
 * Returns '' when the chart is not mounted — the PDF says so rather than
 * silently leaving a gap where a chart should be.
 */
export const serialiseChartSvg = () => {
    if (typeof document === 'undefined') return '';
    const live = document.querySelector('.dental-chart-container svg');
    if (!live) return '';

    const clone = live.cloneNode(true);
    const liveNodes = [live, ...live.querySelectorAll('*')];
    const cloneNodes = [clone, ...clone.querySelectorAll('*')];

    liveNodes.forEach((node, i) => {
        const target = cloneNodes[i];
        if (!target) return;

        const computed = window.getComputedStyle(node);
        const props = node.tagName === 'text' || node.tagName === 'tspan'
            ? [...PAINT_PROPS, ...TEXT_PROPS]
            : PAINT_PROPS;

        props.forEach(([attr, key]) => {
            const value = computed[key];
            // `none` on fill is meaningful and must be kept; an empty or
            // fully-default value is not worth the bytes.
            if (value && value !== 'normal' && value !== 'auto') {
                target.setAttribute(attr, value);
            }
        });

        // The stylesheet is not coming with us, so the classes are dead weight
        // — and `class` on a serialised node is what makes a reader think it
        // still has styling it does not have.
        target.removeAttribute('class');

        // The selection glow is a filter on the tooth the doctor happens to
        // have open. It is UI state, not a clinical finding, and has no place
        // in the record.
        if (target.getAttribute && target.getAttribute('filter')) {
            target.removeAttribute('filter');
        }
    });

    // A standalone file needs its own namespace; inside an HTML document the
    // browser supplies one implicitly and the attribute is often absent.
    if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    // Drop the interactive cursor so the PDF does not inherit a pointer.
    clone.removeAttribute('style');

    return new XMLSerializer().serializeToString(clone);
};

export default serialiseChartSvg;
