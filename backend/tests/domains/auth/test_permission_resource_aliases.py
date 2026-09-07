"""`billing` and `finance` name the same module, and nothing used to translate.

The role presets in domains/auth/role_presets.py write `finance`. The
Permissions screen and several route guards ask for `billing`. A check for
`billing.view` therefore read a key no staff account has ever had — measured
against a real database: of seven staff users, six carried `finance` and zero
carried `billing`.

The visible symptom was the one a clinic reported: a receptionist creating an
invoice saw no price-list suggestions, because GET /treatment-types 403'd for
every non-owner no matter what the owner had configured.

These tests pin both halves — that the alias works, and that it did not quietly
widen anything.
"""
from types import SimpleNamespace

import pytest

from core.auth_utils import has_permission


def user(role="receptionist", **modules):
    return SimpleNamespace(role=role, permissions=dict(modules))


RECEPTIONIST = {"finance": {"read": True, "write": True, "edit": False, "delete": False}}
DOCTOR = {"finance": {"read": True, "write": False, "edit": False, "delete": False}}


@pytest.mark.parametrize("resource", ["billing", "finance"])
def test_stored_finance_satisfies_either_name(resource):
    """The whole bug in one assertion: a preset writes `finance`, a guard asks
    for `billing`, and the answer has to be the same either way."""
    assert has_permission(user(**RECEPTIONIST), "view", resource) is True


def test_stored_billing_also_satisfies_finance():
    """Rows in the wild use both spellings, so the alias has to run both ways."""
    assert has_permission(user(billing={"view": True}), "read", "finance") is True


def test_action_synonyms_still_apply_through_the_alias():
    """`write` has to satisfy a required `edit` across the alias too, or the
    aliasing fixes reads and leaves writes broken."""
    assert has_permission(user(**RECEPTIONIST), "edit", "billing") is True
    # ...but a role that genuinely has no write access still does not get one.
    assert has_permission(user(**DOCTOR), "edit", "billing") is False


def test_denial_still_denies():
    """The alias must not become a way in. An owner who switches finance off
    has to actually switch it off."""
    off = user(finance={"read": False, "write": False, "edit": False, "delete": False})
    assert has_permission(off, "view", "billing") is False
    assert has_permission(off, "edit", "billing") is False
    assert has_permission(user(), "view", "billing") is False
    assert has_permission(None, "view", "billing") is False


def test_unrelated_modules_are_not_widened():
    """Only the pairs in RESOURCE_ALIASES are linked; nothing else leaks."""
    u = user(finance={"read": True, "write": True})
    for resource in ("patients", "appointments", "reports", "lab", "settings"):
        assert has_permission(u, "view", resource) is False, resource


def test_owner_bypasses_everything():
    assert has_permission(user(role="clinic_owner"), "delete", "billing") is True


def test_treatment_types_guards_use_the_shared_helper():
    """The guards were hand-rolled, which is how they skipped both the action
    synonyms and the resource aliases. Reading the source keeps them honest —
    a reintroduced inline check would pass every test above and still 403.

    Only treatment_types is checked. domains/medical/routes/scan_types.py has
    the same guards and was updated alongside it, but that module cannot be
    imported at all (`ScanType` is not in models.py) and is registered nowhere,
    so asserting on it would only pin dead code to the test suite."""
    import inspect
    from domains.patient.routes import treatment_types

    src = inspect.getsource(treatment_types)
    assert 'get("billing"' not in src, "treatment_types hand-rolls its permission check again"
    assert "has_permission(" in src, "treatment_types no longer uses the shared helper"
