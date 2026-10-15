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

export const MAX_MATCHES = 2000;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Case-insensitive, literal (not regex) search. Stops after `cap` matches.
 * @param {string} code
 * @param {string} query
 * @param {number} cap
 * @returns {{matches: Array<{start: number, end: number}>, truncated: boolean}}
 */
export function findMatches(code, query, cap = MAX_MATCHES) {
    const matches = [];
    if (!query || !code) {
        return { matches, truncated: false };
    }
    const pattern = new RegExp(escapeRegExp(query), 'gi');
    let hit = pattern.exec(code);
    while (hit) {
        if (matches.length >= cap) {
            return { matches, truncated: true };
        }
        matches.push({ start: hit.index, end: hit.index + hit[0].length });
        hit = pattern.exec(code);
    }
    return { matches, truncated: false };
}

/**
 * Wrap each match in <mark class="find-match"> elements using DOM APIs only
 * (text nodes are split, never re-parsed), so syntax spans are preserved and
 * nothing from the source is interpreted as markup. A match spanning several
 * syntax spans gets one mark per text node.
 * @param {Node} root element whose textContent the offsets refer to
 * @param {Array<{start: number, end: number}>} matches sorted, non-overlapping
 * @returns {HTMLElement[][]} marks grouped per match
 */
export function wrapMatches(root, matches) {
    const groups = matches.map(() => []);
    if (!matches.length) {
        return groups;
    }
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        nodes.push(n);
    }
    let offset = 0;
    let first = 0;
    for (const node of nodes) {
        const nodeStart = offset;
        const nodeEnd = offset + node.nodeValue.length;
        offset = nodeEnd;
        while (first < matches.length && matches[first].end <= nodeStart) {
            first++;
        }
        const segments = [];
        for (let m = first; m < matches.length; m++) {
            if (matches[m].start >= nodeEnd) {
                break;
            }
            segments.push({
                m,
                s: Math.max(matches[m].start, nodeStart) - nodeStart,
                e: Math.min(matches[m].end, nodeEnd) - nodeStart
            });
        }
        // Last to first, so splitting never shifts the offsets still to do
        for (let i = segments.length - 1; i >= 0; i--) {
            const { m, s, e } = segments[i];
            if (e <= s) {
                continue;
            }
            const target = s > 0 ? node.splitText(s) : node;
            if (e - s < target.nodeValue.length) {
                target.splitText(e - s);
            }
            const mark = doc.createElement('mark');
            mark.className = 'find-match';
            target.parentNode.insertBefore(mark, target);
            mark.appendChild(target);
            groups[m].push(mark);
        }
    }
    return groups;
}

/**
 * @param {string} code
 * @param {number} line 1-based
 * @returns {number} character offset of the start of that line
 */
export function lineStartOffset(code, line) {
    let offset = 0;
    for (let l = 1; l < line; l++) {
        const next = code.indexOf('\n', offset);
        if (next === -1) {
            return code.length;
        }
        offset = next + 1;
    }
    return offset;
}
