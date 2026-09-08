import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { UNIVERSAL_UPPER, UNIVERSAL_LOWER } from './dentalConstants';

/**
 * Which teeth are selected, and the gestures that change that.
 *
 * The chart was single-select: one scalar, compared with `===`. Charting caries
 * on four teeth meant opening the same drawer four times, and a quadrant
 * scaling meant eight. Every other dental system solves this the same way, so
 * this hook implements the gestures a dentist arriving from Open Dental or
 * Dentrix already has in their hands:
 *
 *   click              select just this one (and click again to drop it)
 *   ctrl / cmd click   add or remove one
 *   shift click        the run from the last tooth clicked to this one
 *   drag               the same run, by pointer
 *   quadrant / arch    whole groups at once
 *
 * Two things it has to keep straight:
 *
 * 1. `selectedTooth` is polymorphic. The soft-tissue and TMJ tabs select by
 *    name — "Tongue", "Left TMJ" — not by number. Those cannot be part of a
 *    group, so selecting one collapses the selection to itself and the group
 *    gestures are refused.
 * 2. Everything downstream still reads a single `selectedTooth`. `primary`
 *    is that value, so no existing consumer has to know this hook exists.
 */

/* Arch order as drawn, left to right. A "range" is a run along the arch, which
   is what a dentist means by it — not a run of numbers, since Universal 1-32
   wraps around the mouth and would select the wrong teeth across the midline. */
const ARCH_ORDER = {
  upper: UNIVERSAL_UPPER,
  lower: UNIVERSAL_LOWER,
};

/* FDI quadrants, in stored Universal numbers. */
export const QUADRANTS = {
  UR: { label: 'Upper right', teeth: [1, 2, 3, 4, 5, 6, 7, 8] },
  UL: { label: 'Upper left', teeth: [9, 10, 11, 12, 13, 14, 15, 16] },
  LL: { label: 'Lower left', teeth: [17, 18, 19, 20, 21, 22, 23, 24] },
  LR: { label: 'Lower right', teeth: [25, 26, 27, 28, 29, 30, 31, 32] },
};

const isNumericTooth = (t) => t !== null && t !== '' && Number.isFinite(Number(t));

const archOf = (tooth) => (UNIVERSAL_UPPER.includes(Number(tooth)) ? 'upper' : 'lower');

/** The teeth between two, walking along the arch they share. */
const runBetween = (a, b) => {
  const archA = archOf(a);
  if (archA !== archOf(b)) return [Number(b)];       // across arches, just take the new one
  const order = ARCH_ORDER[archA];
  const i = order.indexOf(Number(a));
  const j = order.indexOf(Number(b));
  if (i === -1 || j === -1) return [Number(b)];
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
};

export const useToothSelection = () => {
  const [selectedTeeth, setSelectedTeeth] = useState([]);
  /* Sticky additive mode. A modifier key is invisible and does not exist on a
     tablet, so the same behaviour is offered as a control you can see and tap.
     It is safe to leave on: adding a procedure clears the selection, so the
     first click after that selects one tooth exactly as it always did. */
  const [multiMode, setMultiMode] = useState(false);
  const anchorRef = useRef(null);   // last tooth clicked, for shift-range
  const dragRef = useRef(null);     // { additive } while a drag is running

  const selectedSet = useMemo(() => new Set(selectedTeeth.map(Number)), [selectedTeeth]);

  const clear = useCallback(() => {
    setSelectedTeeth([]);
    anchorRef.current = null;
  }, []);

  /** Replace the selection outright. */
  const setOnly = useCallback((tooth) => {
    setSelectedTeeth(tooth === null || tooth === undefined ? [] : [tooth]);
    anchorRef.current = isNumericTooth(tooth) ? Number(tooth) : null;
  }, []);

  const toggle = useCallback((tooth) => {
    const n = Number(tooth);
    setSelectedTeeth((prev) => {
      const nums = prev.filter(isNumericTooth).map(Number);
      return nums.includes(n) ? nums.filter((t) => t !== n) : [...nums, n];
    });
    anchorRef.current = n;
  }, []);

  const addMany = useCallback((teeth) => {
    setSelectedTeeth((prev) => {
      const nums = prev.filter(isNumericTooth).map(Number);
      const merged = new Set(nums);
      teeth.forEach((t) => merged.add(Number(t)));
      return [...merged];
    });
  }, []);

  /**
   * The click handler the chart calls. `modifiers` comes straight off the
   * pointer event, so the chart does not have to know what any of them mean.
   */
  const select = useCallback((tooth, modifiers = {}) => {
    if (tooth === null || tooth === undefined) return clear();

    // Anatomy (Tongue, Left TMJ...) is never part of a group.
    if (!isNumericTooth(tooth)) return setOnly(tooth);

    const n = Number(tooth);
    const { range } = modifiers;
    // The toggle and the modifier key mean the same thing; either one is enough.
    const additive = modifiers.additive || multiMode;

    if (range && anchorRef.current !== null) {
      const run = runBetween(anchorRef.current, n);
      setSelectedTeeth((prev) => {
        const merged = new Set(prev.filter(isNumericTooth).map(Number));
        run.forEach((t) => merged.add(t));
        return [...merged];
      });
      return;
    }

    if (additive) return toggle(n);

    // Plain click on the only selected tooth clears it, as it always has.
    setSelectedTeeth((prev) => {
      const nums = prev.filter(isNumericTooth).map(Number);
      return nums.length === 1 && nums[0] === n ? [] : [n];
    });
    anchorRef.current = n;
  }, [clear, setOnly, toggle, multiMode]);

  const selectQuadrant = useCallback((key, additive = false) => {
    const q = QUADRANTS[key];
    if (!q) return;
    if (additive) return addMany(q.teeth);
    setSelectedTeeth(q.teeth);
    anchorRef.current = q.teeth[0];
  }, [addMany]);

  const selectArch = useCallback((which) => {
    const teeth = which === 'all'
      ? [...UNIVERSAL_UPPER, ...UNIVERSAL_LOWER]
      : ARCH_ORDER[which] || [];
    setSelectedTeeth(teeth);
    anchorRef.current = teeth[0] ?? null;
  }, []);

  /* Drag. Pointer-driven, so it starts on a tooth and grows as the pointer
     passes over others. A drag that never leaves its first tooth is just a
     click, which is why the pointerdown selects it outright first. */
  const beginDrag = useCallback((tooth, modifiers = {}) => {
    if (!isNumericTooth(tooth)) return;
    const additive = modifiers.additive || multiMode;
    dragRef.current = { additive };
    if (additive) toggle(tooth);
    else { setSelectedTeeth([Number(tooth)]); anchorRef.current = Number(tooth); }
  }, [toggle, multiMode]);

  const dragOver = useCallback((tooth) => {
    if (!dragRef.current || !isNumericTooth(tooth)) return;
    addMany([tooth]);
  }, [addMany]);

  const endDrag = useCallback(() => { dragRef.current = null; }, []);
  const isDragging = useCallback(() => dragRef.current !== null, []);

  const isSelected = useCallback((tooth) => selectedSet.has(Number(tooth)), [selectedSet]);

  /* Escape drops the selection, which also closes the tooth drawer — the thing
     anyone reaches for Escape to do. Bound only while something is selected, so
     it never competes with a modal's own Escape handler when the chart is idle.
     A modal open on top of the chart (the delete confirmation, the share
     dialog) gets first refusal: it stops propagation before this sees the key. */
  useEffect(() => {
    if (!selectedTeeth.length) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      clear();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedTeeth.length, clear]);

  return {
    selectedTeeth,
    multiMode,
    setMultiMode,
    /* What every existing single-tooth consumer reads. */
    primary: selectedTeeth.length ? selectedTeeth[0] : null,
    isMulti: selectedTeeth.length > 1,
    select,
    setOnly,
    toggle,
    selectQuadrant,
    selectArch,
    clear,
    isSelected,
    beginDrag,
    dragOver,
    endDrag,
    isDragging,
  };
};

export default useToothSelection;
