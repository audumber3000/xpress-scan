/**
 * The handful of runtime APIs an older Safari does not have.
 *
 * Imported first in main.jsx, before React and before anything else, because a
 * missing method throws at the moment it is called and that can be during the
 * first render of a dependency.
 *
 * Syntax is not handled here. `?.` and `??` are lowered by esbuild through
 * `build.target` in vite.config.js — a polyfill cannot help with syntax, since
 * the file fails to parse before any of it runs.
 *
 * Deliberately small. This is not core-js: it covers what the bundle actually
 * calls (checked against the built output), and each one is feature-detected so
 * a modern browser keeps its native implementation.
 */

// Array.prototype.at / String.prototype.at — Safari 15.4.
// The bundle calls .at() several hundred times, mostly from dependencies.
for (const Ctor of [Array, String]) {
  if (!Ctor.prototype.at) {
    Object.defineProperty(Ctor.prototype, 'at', {
      value: function at(index) {
        const len = this.length;
        let i = Math.trunc(index) || 0;
        if (i < 0) i += len;
        return i < 0 || i >= len ? undefined : this[i];
      },
      writable: true,
      configurable: true,
    });
  }
}

// Object.hasOwn — Safari 15.4.
if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (obj, key) => Object.prototype.hasOwnProperty.call(Object(obj), key),
    writable: true,
    configurable: true,
  });
}

/**
 * structuredClone — Safari 15.4.
 *
 * The real thing handles Dates, Maps, Sets, ArrayBuffers and cycles. This
 * handles the first three and cycles, and falls back to returning the value
 * untouched for anything exotic rather than throwing.
 *
 * Not a faithful replacement, and it does not pretend to be: the two call sites
 * in this bundle clone plain data. If something starts cloning a Blob on an old
 * iPad, it wants a real polyfill, not this.
 */
if (typeof globalThis.structuredClone !== 'function') {
  const clone = (value, seen) => {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);

    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);

    if (value instanceof Map) {
      const out = new Map();
      seen.set(value, out);
      value.forEach((v, k) => out.set(clone(k, seen), clone(v, seen)));
      return out;
    }
    if (value instanceof Set) {
      const out = new Set();
      seen.set(value, out);
      value.forEach((v) => out.add(clone(v, seen)));
      return out;
    }
    if (Array.isArray(value)) {
      const out = [];
      seen.set(value, out);
      value.forEach((v, i) => { out[i] = clone(v, seen); });
      return out;
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;

    const out = {};
    seen.set(value, out);
    for (const key of Object.keys(value)) out[key] = clone(value[key], seen);
    return out;
  };

  globalThis.structuredClone = (value) => clone(value, new WeakMap());
}
