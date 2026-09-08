"""How teeth and their surfaces are written, server side.

The frontend owns the same rules in
`components/patient/dentalConstants.js`. They are restated here rather than
shared because the two runtimes cannot import each other, and a PDF or a
quotation that spells a surface differently from the chart it came off is worse
than a small duplication. If one changes, change both.

The rules:
  * Storage is Universal (1-32); doctors read FDI. Convert only when showing.
  * Anterior teeth (canine to canine) have an INCISAL edge, not an occlusal
    surface, so the stored key `O` is written `I` on those teeth.
  * Upper teeth face the PALATE, so the stored key `L` is written `P` there.
"""

_UNIVERSAL_TO_FDI = {
    1: 18, 2: 17, 3: 16, 4: 15, 5: 14, 6: 13, 7: 12, 8: 11,
    9: 21, 10: 22, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
    17: 38, 18: 37, 19: 36, 20: 35, 21: 34, 22: 33, 23: 32, 24: 31,
    25: 41, 26: 42, 27: 43, 28: 44, 29: 45, 30: 46, 31: 47, 32: 48,
}

_ANTERIOR = {6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27}
_PRIMARY_ANTERIOR = {51, 52, 53, 61, 62, 63, 71, 72, 73, 81, 82, 83}

# The order surfaces are written in, whatever order they were ticked.
_SURFACE_ORDER = ("M", "O", "D", "B", "L")


def _as_int(tooth):
    try:
        return int(tooth)
    except (TypeError, ValueError):
        return None


def universal_to_fdi(tooth):
    """Universal to FDI. Anything unrecognised comes back unchanged, so a
    hand-typed tooth still prints instead of vanishing."""
    n = _as_int(tooth)
    return _UNIVERSAL_TO_FDI.get(n, tooth) if n is not None else tooth


def is_anterior(tooth) -> bool:
    n = _as_int(tooth)
    return n in _ANTERIOR or n in _PRIMARY_ANTERIOR


def is_upper(tooth) -> bool:
    n = _as_int(tooth)
    if n is None:
        return False
    return 1 <= n <= 16 or 51 <= n <= 65


def surface_short(tooth, key: str) -> str:
    """The letter this surface is written with on THIS tooth."""
    if key == "O":
        return "I" if is_anterior(tooth) else "O"
    if key == "L":
        return "P" if is_upper(tooth) else "L"
    return key


def format_surfaces(tooth, surfaces) -> str:
    """['D','O'] on tooth 10 -> "ID". Empty string when there are none."""
    if not isinstance(surfaces, (list, tuple)) or not surfaces:
        return ""
    keys = {str(s).upper() for s in surfaces}
    return "".join(surface_short(tooth, k) for k in _SURFACE_ORDER if k in keys)
