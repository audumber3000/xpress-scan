/**
 * Consent wording comes in two shapes and this is the one place that knows it.
 *
 * Plain text (every form written before the editor, and every library form):
 * one paragraph per line. Formatted (written in the editor): HTML, starting
 * with a block tag. The backend tells them apart the same way, in
 * backend/domains/consent/rich_content.py, so keep the two patterns in step.
 */

import DOMPurify from 'dompurify';

const BLOCK_START = /^\s*<(p|h[1-6]|ul|ol|table|blockquote|hr|div)(\s|>|\/)/i;

export const isHtmlContent = (content) => !!content && BLOCK_START.test(content);

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain wording as editor HTML: each non-empty line becomes a paragraph. */
export const plainToHtml = (text) =>
  (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join('');

/**
 * Formatted wording made safe to put in the page. The backend sanitises on
 * save, but the signing page receives its copy through Nexus, which takes the
 * content from the browser, so it is cleaned again here against the same
 * short list of tags the editor can produce.
 */
export const safeConsentHtml = (html) => DOMPurify.sanitize(html || '', {
  ALLOWED_TAGS: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'mark',
    'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'div'],
  ALLOWED_ATTR: ['style', 'colspan', 'rowspan', 'data-page-break'],
});

/** A one-line preview for tables, whatever the wording's shape. */
export const previewText = (content) => {
  if (!content) return '';
  if (!isHtmlContent(content)) return content;
  const doc = new DOMParser().parseFromString(content, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

/** True when the editor holds nothing but empty paragraphs. */
export const isEmptyHtml = (html) => !previewText(html || '').trim();

// Mirrors LANGUAGES in backend/domains/consent/library/__init__.py.
export const CONSENT_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
];

export const languageLabel = (code) => {
  const lang = CONSENT_LANGUAGES.find((l) => l.code === (code || 'en'));
  return lang ? lang.native : code;
};

// Mirrors CATEGORIES in backend/domains/consent/starter_templates.py.
export const CONSENT_CATEGORIES = [
  { key: 'surgical', label: 'Surgical' },
  { key: 'endodontic', label: 'Root canal' },
  { key: 'periodontal', label: 'Gums' },
  { key: 'prosthodontic', label: 'Crowns and dentures' },
  { key: 'ortho', label: 'Orthodontics' },
  { key: 'paediatric', label: 'Children' },
  { key: 'implant', label: 'Implants' },
  { key: 'sedation', label: 'Anaesthesia' },
  { key: 'cosmetic', label: 'Cosmetic' },
  { key: 'general', label: 'General' },
  { key: 'media', label: 'Photos and media' },
];

export const categoryLabel = (key) =>
  CONSENT_CATEGORIES.find((c) => c.key === key)?.label || 'Consent form';
