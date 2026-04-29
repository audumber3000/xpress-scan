"""Golden snapshot tests for prescription variants (Classic + Compact).

Runs the real PrescriptionService.render_prescription_html against deterministic
sample data, with a stub DB so tests stay DB-free. Locks down both variants so
template tweaks become visible diffs rather than silent drift.
"""
from __future__ import annotations

import datetime
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from domains.infrastructure.services.preview_samples import (
    sample_clinic, sample_patient, sample_prescription_request,
)
from domains.medical.services.prescription_service import PrescriptionService

GOLDEN_DIR = Path(__file__).resolve().parents[2] / "golden"


class _StubDB:
    """Quack-types as a SQLAlchemy session — render path takes config_override
    so the DB query is never executed in these tests."""
    def query(self, *a, **kw): return self
    def filter(self, *a, **kw): return self
    def first(self): return None


_FROZEN_NOW = datetime.datetime(2026, 4, 28, 10, 0, 0)


class _FrozenDatetime(datetime.datetime):
    """datetime subclass with a fixed `now()` so prescription goldens are
    stable across days. The renderer calls `datetime.now()` for the printed
    date, so freezing it removes the only non-deterministic field."""
    @classmethod
    def now(cls, tz=None):
        return _FROZEN_NOW


def _render(template_id: str, color: str = "#2a276e", footer: str = "Computer-generated.") -> str:
    cfg = SimpleNamespace(
        template_id=template_id,
        primary_color=color,
        footer_text=footer,
        logo_url=None,
    )
    svc = PrescriptionService(_StubDB())
    with patch("domains.medical.services.prescription_service.datetime", _FrozenDatetime):
        return svc.render_prescription_html(
            sample_patient(), sample_clinic(), sample_prescription_request(),
            config_override=cfg,
        )


def _check_golden(rendered: str, golden_path: Path):
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    if os.environ.get("UPDATE_GOLDEN") == "1" or not golden_path.exists():
        golden_path.write_text(rendered, encoding="utf-8")
        if not os.environ.get("UPDATE_GOLDEN"):
            import pytest
            pytest.skip(f"Wrote new golden at {golden_path}. Re-run to verify.")
        return
    expected = golden_path.read_text(encoding="utf-8")
    assert rendered == expected, (
        f"Prescription HTML diverged from golden at {golden_path}.\n"
        f"Re-run with UPDATE_GOLDEN=1 to refresh if intentional."
    )


def test_classic_prescription_matches_golden():
    _check_golden(_render("classic"), GOLDEN_DIR / "prescription_classic.html")


def test_compact_prescription_matches_golden():
    _check_golden(_render("compact"), GOLDEN_DIR / "prescription_compact.html")


def test_legacy_template_id_aliases_to_classic():
    """Old DB rows have template_id='standard' / 'default' — registry must
    alias these to classic, render byte-identical, never 500."""
    standard = _render("standard")
    classic = _render("classic")
    assert standard == classic


def test_unknown_template_id_falls_back_to_classic():
    unknown = _render("some-removed-variant")
    classic = _render("classic")
    assert unknown == classic


def test_classic_and_compact_produce_distinct_output():
    """Sanity check: variants must actually render differently."""
    assert _render("classic") != _render("compact")
