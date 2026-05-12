#!/usr/bin/env python3
"""
Desktop icon generator for the MolarPlus Tauri wrapper.

Source of truth: the mobile app's adaptive icon (1024x1024 master) at
`mobile-app/assets/adaptive-icon.png` — same brand mark that ships on iOS/Android.

Run this whenever the mobile icon changes:

    python3 desktop/src-tauri/icons/generate.py

Produces every PNG / .icns / .ico size that Tauri references in tauri.conf.json.
"""

import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ICON_DIR = Path(__file__).resolve().parent
REPO_ROOT = ICON_DIR.parents[2]
SOURCE = REPO_ROOT / "mobile-app" / "assets" / "adaptive-icon.png"

# Sizes Tauri's bundle.icon list references directly.
BUNDLE_PNG_SIZES = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
}

# Sizes iconutil wants in a .iconset directory to build a .icns.
ICNS_SIZES = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]

# Sizes embedded in the multi-resolution .ico. 256 is the largest a Windows .ico
# entry can encode in its directory header (a 0 byte means "256+").
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def sips_resize(src: Path, dst: Path, size: int) -> None:
    subprocess.run(
        ["sips", "-z", str(size), str(size), str(src), "--out", str(dst)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def build_ico(out: Path, png_paths: list[tuple[int, Path]]) -> None:
    """Pack a set of PNGs into a single multi-resolution .ico."""
    blobs = [(size, p.read_bytes()) for size, p in png_paths]
    header = struct.pack("<HHH", 0, 1, len(blobs))
    directory = b""
    payload = b""
    offset = 6 + (16 * len(blobs))
    for size, blob in blobs:
        wh = 0 if size >= 256 else size
        directory += struct.pack(
            "<BBBBHHII",
            wh, wh,       # width, height
            0,            # palette
            0,            # reserved
            1,            # color planes
            32,           # bits per pixel
            len(blob),
            offset,
        )
        payload += blob
        offset += len(blob)
    out.write_bytes(header + directory + payload)


def main() -> int:
    if not SOURCE.exists():
        print(f"ERROR: source icon not found at {SOURCE}", file=sys.stderr)
        return 1

    ICON_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Copy the master 1024 PNG so the desktop bundle has a self-contained source.
    master = ICON_DIR / "icon.png"
    master.write_bytes(SOURCE.read_bytes())

    # 2. Generate the bundle PNGs that tauri.conf.json directly references.
    for filename, size in BUNDLE_PNG_SIZES.items():
        sips_resize(master, ICON_DIR / filename, size)

    # 3. Generate .icns via iconutil (macOS native).
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "MolarPlus.iconset"
        iconset.mkdir()
        for size, name in ICNS_SIZES:
            sips_resize(master, iconset / name, size)
        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(ICON_DIR / "icon.icns")],
            check=True,
        )

    # 4. Generate multi-res .ico for Windows.
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        ico_pngs: list[tuple[int, Path]] = []
        for size in ICO_SIZES:
            p = tmpdir / f"ico_{size}.png"
            sips_resize(master, p, size)
            ico_pngs.append((size, p))
        build_ico(ICON_DIR / "icon.ico", ico_pngs)

    print(f"Regenerated MolarPlus icons in {ICON_DIR} from {SOURCE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
