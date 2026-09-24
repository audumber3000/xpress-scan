"""The consent form library: the six starter forms, in every language we ship.

English is the set every clinic is seeded with (starter_templates.py, which
seed_consents still reads directly, so seeding is unchanged). The other
languages are never seeded. A clinic browses them here and copies the ones it
wants into its own list, where they become ordinary, editable rows.

Every language carries the same six forms under the same keys, which are the
category keys, so "the root canal one" is the same form in each language.
All wording is plain text, one paragraph per line, like the English starters.
"""
from importlib import import_module

from domains.consent.starter_templates import STARTER_TEMPLATES

# Order is the order of the language chips in the web library.
LANGUAGES = [
    {"code": "en", "label": "English", "native": "English"},
    {"code": "hi", "label": "Hindi", "native": "हिन्दी"},
    {"code": "mr", "label": "Marathi", "native": "मराठी"},
    {"code": "te", "label": "Telugu", "native": "తెలుగు"},
    {"code": "ta", "label": "Tamil", "native": "தமிழ்"},
    {"code": "kn", "label": "Kannada", "native": "ಕನ್ನಡ"},
    {"code": "gu", "label": "Gujarati", "native": "ગુજરાતી"},
]
LANGUAGE_CODES = {lang["code"] for lang in LANGUAGES}

FORM_KEYS = [t["category"] for t in STARTER_TEMPLATES]


def library_forms(language: str):
    """[{key, name, category, language, content}] for one language, or []."""
    if language not in LANGUAGE_CODES:
        return []
    if language == "en":
        return [
            {"key": t["category"], "name": t["name"], "category": t["category"],
             "language": "en", "content": t["content"]}
            for t in STARTER_TEMPLATES
        ]
    forms = import_module(f"domains.consent.library.{language}").FORMS
    return [
        {"key": key, "name": forms[key][0], "category": key,
         "language": language, "content": forms[key][1]}
        for key in FORM_KEYS if key in forms
    ]


def library_form(language: str, key: str):
    return next((f for f in library_forms(language) if f["key"] == key), None)
