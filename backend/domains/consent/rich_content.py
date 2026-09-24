"""Formatted consent wording: telling it apart from plain text, and making it safe.

Consent `content` used to be plain text only, one paragraph per line, escaped
on its way into the PDF (see starter_templates.py). The web editor now writes
HTML (headings, bold, lists, tables) so a clinic can lay a form out the way
its paper one looks.

Both kinds live in the same column and no flag says which is which, on
purpose: the content travels through Nexus (generate, preview, sign) as a bare
string, and a format flag would have meant changing Nexus too. The content
says what it is instead: formatted wording always starts with one of the block
tags the editor writes, and plain wording never does in practice. When plain
text does happen to start with "<p>", it goes through the sanitiser like any
other HTML, so the worst outcome is a formatting surprise, never a script.

The sanitiser rebuilds the markup rather than filtering it. Every tag and
attribute not on the allowlist is dropped, all text is re-escaped, and style
is cut down to a handful of properties with values checked against patterns.
Nothing the input says is copied through verbatim.
"""
import html
import re
from html.parser import HTMLParser

_BLOCK_START = re.compile(
    r'^\s*<(p|h[1-6]|ul|ol|table|blockquote|hr|div)(\s|>|/)', re.IGNORECASE
)

# Tags the editor produces. Anything else is unwrapped: its text survives, the
# tag does not.
_ALLOWED_TAGS = {
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's',
    'span', 'mark', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'colgroup', 'col', 'div',
}
_VOID_TAGS = {'br', 'hr', 'col'}
# Whole subtrees whose text must never reach the page.
_DROP_WITH_CONTENT = {'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math'}

_ALLOWED_ATTRS = {'colspan', 'rowspan', 'style', 'data-page-break'}

_COLOR = r'(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.\s,%]+\)|[a-zA-Z]{3,20})'
_LENGTH = r'(\d{1,3}(\.\d+)?(px|pt|em|rem|%)?)'
_STYLE_RULES = {
    'color': re.compile(rf'^{_COLOR}$'),
    'background-color': re.compile(rf'^{_COLOR}$'),
    'text-align': re.compile(r'^(left|right|center|justify)$'),
    'font-size': re.compile(rf'^{_LENGTH}$'),
    'font-family': re.compile(r'^[a-zA-Z0-9 ,\'"-]{1,80}$'),
    'font-weight': re.compile(r'^(normal|bold|[1-9]00)$'),
    'font-style': re.compile(r'^(normal|italic)$'),
    'text-decoration': re.compile(r'^(none|underline|line-through)$'),
    'margin-left': re.compile(rf'^{_LENGTH}$'),
    'padding-left': re.compile(rf'^{_LENGTH}$'),
    'width': re.compile(rf'^{_LENGTH}$'),
    'min-width': re.compile(rf'^{_LENGTH}$'),
    'page-break-after': re.compile(r'^(always|auto)$'),
    'break-after': re.compile(r'^(page|auto)$'),
}


def is_html(content) -> bool:
    """True when the wording was written by the formatted editor."""
    return bool(content) and bool(_BLOCK_START.match(content))


def _clean_style(value: str) -> str:
    kept = []
    for decl in (value or '').split(';'):
        if ':' not in decl:
            continue
        prop, val = decl.split(':', 1)
        prop, val = prop.strip().lower(), val.strip()
        rule = _STYLE_RULES.get(prop)
        if rule and rule.match(val) and 'url' not in val.lower() and 'expression' not in val.lower():
            kept.append(f'{prop}: {val}')
    return '; '.join(kept)


class _Sanitiser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.open = []       # allowed tags currently open, for balanced output
        self.drop_depth = 0  # >0 while inside a dropped subtree

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in _DROP_WITH_CONTENT:
            self.drop_depth += 1
            return
        if self.drop_depth or tag not in _ALLOWED_TAGS:
            return
        parts = [tag]
        for name, value in attrs:
            name = (name or '').lower()
            if name not in _ALLOWED_ATTRS or value is None:
                continue
            if name == 'style':
                value = _clean_style(value)
                if not value:
                    continue
            elif name in ('colspan', 'rowspan'):
                if not value.isdigit() or not 0 < int(value) <= 50:
                    continue
            elif name == 'data-page-break':
                value = 'true'
            parts.append(f'{name}="{html.escape(value, quote=True)}"')
        self.out.append('<' + ' '.join(parts) + '>')
        if tag not in _VOID_TAGS:
            self.open.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        tag = tag.lower()
        if tag not in _VOID_TAGS and self.open and self.open[-1] == tag:
            self.open.pop()
            self.out.append(f'</{tag}>')

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in _DROP_WITH_CONTENT:
            self.drop_depth = max(0, self.drop_depth - 1)
            return
        if self.drop_depth or tag not in self.open:
            return
        # Close anything left open inside it, so the output always nests.
        while self.open:
            t = self.open.pop()
            self.out.append(f'</{t}>')
            if t == tag:
                break

    def handle_data(self, data):
        if not self.drop_depth:
            self.out.append(html.escape(data, quote=False))

    def result(self) -> str:
        while self.open:
            self.out.append(f'</{self.open.pop()}>')
        return ''.join(self.out)


def sanitize(content: str) -> str:
    """Formatted wording reduced to the allowlist. Safe to embed in a page."""
    parser = _Sanitiser()
    parser.feed(content or '')
    parser.close()
    return parser.result()


def clean_for_storage(content):
    """What gets saved: formatted wording sanitised, plain text untouched."""
    if content and is_html(content):
        return sanitize(content)
    return content
