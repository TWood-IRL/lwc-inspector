import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);

// Highlighting very large files would block the UI, show them as plain text
const MAX_HIGHLIGHT_LENGTH = 200000;

const LANGUAGE_BY_EXTENSION = {
    js: 'javascript',
    html: 'xml',
    xml: 'xml',
    svg: 'xml',
    cmp: 'xml',
    app: 'xml',
    evt: 'xml',
    intf: 'xml',
    design: 'xml',
    css: 'css',
    json: 'json'
};

export const LANGUAGE_LABELS = {
    javascript: 'JavaScript',
    xml: 'HTML / XML',
    css: 'CSS',
    json: 'JSON',
    plaintext: 'Plain Text'
};

/**
 * Work out the language from a file path (LWC) or the Format field (Aura,
 * where the file name is just a definition type such as CONTROLLER)
 * @param {string} fileName
 * @param {string} format
 * @returns {string} a highlight.js language name, or 'plaintext'
 */
export function languageFor(fileName, format) {
    const name = fileName || '';
    const extension = name.includes('.')
        ? name.split('.').pop().toLowerCase()
        : (format || '').toLowerCase();
    return LANGUAGE_BY_EXTENSION[extension] || 'plaintext';
}

const escapeHtml = (text) =>
    text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

/**
 * @param {string} code
 * @param {string} language
 * @returns {string} HTML-escaped markup with highlight spans
 */
export function highlight(code, language) {
    if (
        language === 'plaintext' ||
        code.length > MAX_HIGHLIGHT_LENGTH ||
        !hljs.getLanguage(language)
    ) {
        return escapeHtml(code);
    }
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
}
