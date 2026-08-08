"""Field-visibility resolution.

The contract worth protecting here is the boring one: a clinic that has never
touched the toggles must resolve to "show everything", so its documents keep
rendering exactly as they did before this feature existed. Everything else is
about not letting malformed stored JSON blank out a clinic's letterhead.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from domains.infrastructure.services.pdf_fields import (
    ALL_VISIBLE, FIELD_KEYS, resolve_field_visibility, sanitize_visibility,
)


def cfg(config_json):
    return SimpleNamespace(
        template_id='classic', primary_color='#FF9800',
        footer_text='', logo_url=None, config_json=config_json,
    )


# ── Defaults: the backward-compatibility contract ────────────────────────────

def test_no_config_at_all_shows_everything():
    assert resolve_field_visibility(None) == ALL_VISIBLE


def test_config_object_without_the_attribute_shows_everything():
    """The golden-test fixtures are bare namespaces with only the four styling
    keys. Reading `config.config_json` directly would raise on every one."""
    legacy = SimpleNamespace(template_id='classic', primary_color='#FF9800',
                             footer_text='', logo_url=None)
    assert resolve_field_visibility(legacy) == ALL_VISIBLE


@pytest.mark.parametrize('stored', [None, {}, {'show': {}}, {'show': None},
                                    {'other': 'thing'}, 'not-a-dict', 42, []])
def test_empty_or_malformed_stored_json_shows_everything(stored):
    assert resolve_field_visibility(cfg(stored)) == ALL_VISIBLE


def test_a_partial_map_leaves_unmentioned_fields_shown():
    """Adding a new toggle later must not retroactively hide it for clinics
    whose stored map predates it."""
    vis = resolve_field_visibility(cfg({'show': {'tagline': False}}))
    assert vis.tagline is False
    assert vis.address is True and vis.contact is True and vis.footer is True


# ── Hiding ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize('falsey', [False, 0, 'false', 'False', 'no', 'off', '0', ''])
def test_explicit_falsey_values_hide(falsey):
    assert resolve_field_visibility(cfg({'show': {'address': falsey}})).address is False


@pytest.mark.parametrize('truthy', [True, 1, 'true', 'yes', 'anything'])
def test_anything_else_keeps_the_field(truthy):
    assert resolve_field_visibility(cfg({'show': {'address': truthy}})).address is True


def test_a_value_of_the_wrong_type_keeps_the_field():
    """A document missing its clinic address because of a bad cast is worse
    than one showing it."""
    assert resolve_field_visibility(cfg({'show': {'address': {'nested': 1}}})).address is True


def test_every_field_can_be_hidden():
    vis = resolve_field_visibility(cfg({'show': {k: False for k in FIELD_KEYS}}))
    assert all(getattr(vis, k) is False for k in FIELD_KEYS)


# ── Sanitising what the client sends ─────────────────────────────────────────

def test_sanitize_whitelists_unknown_keys():
    out = sanitize_visibility({'show': {'address': False, 'evil': 'payload'}})
    assert out == {'show': {'address': False}}


def test_sanitize_accepts_a_bare_flag_map():
    assert sanitize_visibility({'address': False}) == {'show': {'address': False}}


def test_sanitize_coerces_to_real_booleans():
    out = sanitize_visibility({'show': {'address': 'false', 'contact': 1}})
    assert out == {'show': {'address': False, 'contact': True}}


@pytest.mark.parametrize('junk', [None, 'string', 42, [], {}, {'show': 'nope'},
                                  {'show': {}}, {'unknown': True}])
def test_sanitize_returns_none_when_there_is_nothing_to_store(junk):
    """An absent value should stay absent rather than be written as {}."""
    assert sanitize_visibility(junk) is None


def test_sanitize_output_round_trips_through_the_resolver():
    stored = sanitize_visibility({'show': {k: False for k in FIELD_KEYS}})
    vis = resolve_field_visibility(cfg(stored))
    assert all(getattr(vis, k) is False for k in FIELD_KEYS)
