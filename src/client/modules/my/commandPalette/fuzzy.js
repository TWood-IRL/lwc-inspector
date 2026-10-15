// Small pure fuzzy matcher for the command palette.
// Subsequence match, case-insensitive, with bonuses for word starts,
// camelCase humps and consecutive characters. Finds the best alignment.

const BONUS_START = 10; // first character of the text
const BONUS_WORD = 8; // after a separator (space, - _ . / etc.)
const BONUS_CAMEL = 7; // lower -> Upper transition
const BONUS_CONSECUTIVE = 6; // directly follows the previous match
const BONUS_EXACT_CASE = 1;
const GAP_PENALTY = 1; // per skipped char between matches (capped)
const MAX_GAP_PENALTY = 5;
const LEADING_PENALTY = 0.25; // per char before the first match (capped)
const MAX_LEADING_PENALTY = 3;
const MAX_QUERY = 40;

const isUpper = (c) => c !== c.toLowerCase() && c === c.toUpperCase();
const isLower = (c) => c !== c.toUpperCase() && c === c.toLowerCase();
const isAlnum = (c) => /[a-z0-9]/i.test(c);

function charBonus(text, j) {
    if (j === 0) return BONUS_START;
    const prev = text[j - 1];
    const cur = text[j];
    if (!isAlnum(prev)) return BONUS_WORD;
    if (isLower(prev) && isUpper(cur)) return BONUS_CAMEL;
    return 0;
}

/**
 * Scores `query` against `text`.
 * @returns {{score:number, indices:number[]}|null} null when query is not a
 * subsequence of text. An empty query matches everything with score 0.
 */
export function fuzzyScore(query, text) {
    const q = String(query ?? '').replace(/\s+/g, '');
    const t = String(text ?? '');
    if (!q) return { score: 0, indices: [] };
    if (q.length > MAX_QUERY || q.length > t.length) return null;
    const ql = q.toLowerCase();
    const tl = t.toLowerCase();

    // Quick subsequence precheck
    let pos = 0;
    for (const ch of ql) {
        pos = tl.indexOf(ch, pos);
        if (pos < 0) return null;
        pos += 1;
    }

    const n = q.length;
    const m = t.length;
    // best[i][j]: best score with q[i] matched at t[j]; from[i][j]: prior j
    const best = [];
    const from = [];
    for (let i = 0; i < n; i++) {
        best.push(new Array(m).fill(-Infinity));
        from.push(new Array(m).fill(-1));
        for (let j = i; j < m; j++) {
            if (tl[j] !== ql[i]) continue;
            const own =
                charBonus(t, j) + (t[j] === q[i] ? BONUS_EXACT_CASE : 0);
            if (i === 0) {
                best[i][j] =
                    own - Math.min(j * LEADING_PENALTY, MAX_LEADING_PENALTY);
                continue;
            }
            for (let k = i - 1; k < j; k++) {
                const prior = best[i - 1][k];
                if (prior === -Infinity) continue;
                const gap = j - k - 1;
                const link =
                    gap === 0
                        ? BONUS_CONSECUTIVE
                        : -Math.min(gap * GAP_PENALTY, MAX_GAP_PENALTY);
                const total = prior + own + link;
                if (total > best[i][j]) {
                    best[i][j] = total;
                    from[i][j] = k;
                }
            }
        }
    }

    let endJ = -1;
    let score = -Infinity;
    for (let j = 0; j < m; j++) {
        if (best[n - 1][j] > score) {
            score = best[n - 1][j];
            endJ = j;
        }
    }
    if (endJ < 0) return null;
    const indices = new Array(n);
    let j = endJ;
    for (let i = n - 1; i >= 0; i--) {
        indices[i] = j;
        j = from[i][j];
    }
    // Prefer shorter texts slightly so exact/short names rank first
    score -= m * 0.05;
    return { score, indices };
}

/**
 * Splits text into [{text, match, key}] segments for rendering.
 * Pure data: never produces HTML, so it is safe to render with templates.
 */
export function highlightSegments(text, indices) {
    const str = String(text ?? '');
    const marked = new Set(indices ?? []);
    const segments = [];
    for (let i = 0; i < str.length; i++) {
        const match = marked.has(i);
        const last = segments[segments.length - 1];
        if (last && last.match === match) {
            last.text += str[i];
        } else {
            segments.push({ text: str[i], match, key: `s${i}` });
        }
    }
    return segments;
}
