/**
 * Consent wording is plain text, or HTML when it was written in the web
 * editor. The app has no rich editor, so it shows formatted wording as clean
 * text and sends people to the web to change it. Detection matches the web
 * (frontend/src/components/consents/consentContent.js) and the backend.
 */
const BLOCK_START = /^\s*<(p|h[1-6]|ul|ol|table|blockquote|hr|div)(\s|>|\/)/i;

export const isFormattedConsent = (content?: string | null): boolean =>
  !!content && BLOCK_START.test(content);

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};

/** Readable text for any consent wording: paragraphs and rows become lines. */
export const consentPlainText = (content?: string | null): string => {
  if (!content) return '';
  if (!isFormattedConsent(content)) return content;
  return content
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|h[1-6]|li|tr|blockquote|div)>|<br\s*\/?>|<hr[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] || m)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const LANGUAGE_NAMES: Record<string, string> = {
  hi: 'हिन्दी', mr: 'मराठी', te: 'తెలుగు', ta: 'தமிழ்', kn: 'ಕನ್ನಡ', gu: 'ગુજરાતી',
};

/** The language's own name, or '' for English (the default, not worth a label). */
export const consentLanguageLabel = (code?: string | null): string =>
  (code && LANGUAGE_NAMES[code]) || '';
