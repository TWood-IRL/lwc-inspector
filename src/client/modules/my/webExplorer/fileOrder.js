// Order files the way they are usually read: template, controller, styles, metadata
const EXTENSION_RANK = { html: 0, js: 1, css: 2, svg: 3, xml: 4 };

// Aura definitions have no file name, only a definition type
const AURA_RANK = {
    COMPONENT: 0,
    APPLICATION: 0,
    EVENT: 0,
    INTERFACE: 0,
    CONTROLLER: 1,
    HELPER: 2,
    RENDERER: 3,
    STYLE: 4,
    DOCUMENTATION: 5,
    DESIGN: 6,
    SVG: 7
};
const UNKNOWN_RANK = 99;

const rankOf = (file) => {
    const label = file.label || '';
    const rank = label.includes('.')
        ? EXTENSION_RANK[label.split('.').pop().toLowerCase()]
        : AURA_RANK[label.toUpperCase()];
    return rank ?? UNKNOWN_RANK;
};

/**
 * @param {Array<{label: string}>} files
 * @returns {Array} a sorted copy, the first entry is the one to open first
 */
export function sortFiles(files) {
    return [...files].sort(
        (a, b) =>
            rankOf(a) - rankOf(b) ||
            (a.label || '').localeCompare(b.label || '')
    );
}
