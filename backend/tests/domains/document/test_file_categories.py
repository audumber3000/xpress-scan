"""Which tab a patient's file lands on.

Every upload went to Documents and the Imaging tab was permanently empty, for
three independent reasons — the upload endpoint took no category, the list
endpoint hardcoded one, and the tab read a table nothing writes to. These tests
pin the vocabulary that now decides it.
"""
import pytest

from core.file_categories import (
    ALL_CATEGORIES, DOCUMENT_CATEGORIES, IMAGING_CATEGORIES,
    is_imaging, normalise_category,
)


@pytest.mark.parametrize('kind', IMAGING_CATEGORIES)
def test_every_imaging_kind_goes_to_imaging(kind):
    assert is_imaging(kind)


@pytest.mark.parametrize('kind', DOCUMENT_CATEGORIES)
def test_every_paperwork_kind_stays_in_documents(kind):
    assert not is_imaging(kind)


def test_the_two_lists_do_not_overlap():
    """A file that both tabs claim is a file shown twice; one neither claims is
    a file nobody finds."""
    assert not set(IMAGING_CATEGORIES) & set(DOCUMENT_CATEGORIES)
    assert len(set(ALL_CATEGORIES)) == len(ALL_CATEGORIES)


@pytest.mark.parametrize('sent,stored', [
    ('OPG', 'OPG'),
    ('opg', 'OPG'),
    ('  CBCT  ', 'CBCT'),
    # What installed tablets still send. The drawer offered these two words for
    # as long as it existed, so they have to keep meaning something.
    ('X-Ray', 'IOPA'),
    ('xray', 'IOPA'),
    ('Intra-Oral', 'Photo'),
    # The values the old renderers wrote: not kinds, just "nobody said".
    ('document', None),
    ('upload', None),
    # Anything unrecognised is stored as nothing rather than as a guess.
    ('bananas', None),
    ('', None),
    (None, None),
    (7, None),
])
def test_what_arrives_is_normalised_before_it_is_stored(sent, stored):
    assert normalise_category(sent) == stored


def test_an_uncategorised_file_is_not_imaging():
    """So it appears under Documents, which is where every upload from before
    the picker existed has always appeared."""
    assert not is_imaging(None)
    assert not is_imaging('document')


def test_the_frontend_list_matches_this_one():
    """Two copies of the vocabulary, one on each side of the wire. They are
    allowed to be two files; they are not allowed to disagree."""
    import pathlib
    import re

    js = (pathlib.Path(__file__).resolve().parents[4]
          / 'frontend/src/utils/fileCategories.js').read_text()

    def listed(name):
        block = re.search(rf'export const {name} = \[(.*?)\];', js, re.S)
        assert block, f'{name} not found in fileCategories.js'
        return tuple(re.findall(r"'([^']+)'", block.group(1)))

    assert listed('IMAGING_CATEGORIES') == IMAGING_CATEGORIES
    assert listed('DOCUMENT_CATEGORIES') == DOCUMENT_CATEGORIES
