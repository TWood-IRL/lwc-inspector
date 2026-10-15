// Pure diff engine: no DOM, no LWC. Everything here is unit tested.

/** Largest edit distance the Myers search explores before giving up */
export const MAX_EDIT_DISTANCE = 1500;
/** Intra-line highlighting limits (keeps huge blocks and minified lines fast) */
export const MAX_PAIRS_FOR_WORD_DIFF = 2000;
export const MAX_LINE_LENGTH_FOR_WORD_DIFF = 1000;
const MAX_TOKEN_CELLS = 250000;
/** Below this share of shared characters a line pair is shown as fully changed */
const MIN_SIMILARITY = 0.25;

/**
 * @param {string} text
 * @returns {string[]} lines without terminators; a trailing newline does not
 * create an extra empty line
 */
export function splitLines(text) {
    if (text === undefined || text === null || text === '') return [];
    const lines = String(text).split(/\r\n|\r|\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

// Classic Myers O(ND). Returns ops for the given (already trimmed) arrays,
// or null when the edit distance exceeds maxD.
function myers(a, b, maxD) {
    const n = a.length;
    const m = b.length;
    const limit = Math.min(maxD, n + m);
    const offset = limit + 1;
    const v = new Int32Array(2 * limit + 3);
    const trace = [];
    for (let d = 0; d <= limit; d++) {
        trace.push(v.slice(offset - d - 1, offset + d + 2));
        for (let k = -d; k <= d; k += 2) {
            let x;
            if (
                k === -d ||
                (k !== d && v[offset + k - 1] < v[offset + k + 1])
            ) {
                x = v[offset + k + 1];
            } else {
                x = v[offset + k - 1] + 1;
            }
            let y = x - k;
            while (x < n && y < m && a[x] === b[y]) {
                x++;
                y++;
            }
            v[offset + k] = x;
            if (x >= n && y >= m) {
                return backtrack(trace, a, b, d);
            }
        }
    }
    return null;
}

function backtrack(trace, a, b, dEnd) {
    const ops = [];
    let x = a.length;
    let y = b.length;
    for (let d = dEnd; d > 0; d--) {
        const snap = trace[d];
        const get = (k) => snap[k + d + 1];
        const k = x - y;
        const prevK =
            k === -d || (k !== d && get(k - 1) < get(k + 1)) ? k + 1 : k - 1;
        const prevX = get(prevK);
        const prevY = prevX - prevK;
        while (x > prevX && y > prevY) {
            x--;
            y--;
            ops.push({ t: 'eq', a: x, b: y });
        }
        if (x === prevX) {
            y--;
            ops.push({ t: 'add', a: -1, b: y });
        } else {
            x--;
            ops.push({ t: 'del', a: x, b: -1 });
        }
    }
    while (x > 0 && y > 0) {
        x--;
        y--;
        ops.push({ t: 'eq', a: x, b: y });
    }
    return ops.reverse();
}

function replaceAll(lenA, lenB) {
    const ops = [];
    for (let i = 0; i < lenA; i++) ops.push({ t: 'del', a: i, b: -1 });
    for (let i = 0; i < lenB; i++) ops.push({ t: 'add', a: -1, b: i });
    return ops;
}

/**
 * Line diff.
 * @param {string[]} a old lines
 * @param {string[]} b new lines
 * @param {{maxDistance?: number}} [options]
 * @returns {{ops: {t: 'eq'|'del'|'add', a: number, b: number}[], coarse: boolean}}
 * `coarse` is true when the files differed too much for an exact diff and the
 * differing middle section is reported as one removal plus one addition.
 */
export function diffLines(a, b, options = {}) {
    const maxD = options.maxDistance ?? MAX_EDIT_DISTANCE;
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) {
        start++;
    }
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
        endA--;
        endB--;
    }
    const ops = [];
    for (let i = 0; i < start; i++) ops.push({ t: 'eq', a: i, b: i });

    const midA = a.slice(start, endA);
    const midB = b.slice(start, endB);
    let coarse = false;
    let mid;
    if (midA.length === 0 || midB.length === 0) {
        mid = replaceAll(midA.length, midB.length);
    } else {
        mid = myers(midA, midB, maxD);
        if (!mid) {
            coarse = true;
            mid = replaceAll(midA.length, midB.length);
        }
    }
    mid.forEach((op) =>
        ops.push({
            t: op.t,
            a: op.a < 0 ? -1 : op.a + start,
            b: op.b < 0 ? -1 : op.b + start
        })
    );
    const tail = a.length - endA;
    for (let i = 0; i < tail; i++) {
        ops.push({ t: 'eq', a: endA + i, b: endB + i });
    }
    return { ops, coarse };
}

const TOKEN_RE = /\s+|[A-Za-z0-9_$]+|[^\sA-Za-z0-9_$]/g;

function pushSegment(list, text, changed) {
    if (!text) return;
    const last = list[list.length - 1];
    if (last && last.changed === changed) last.text += text;
    else list.push({ text, changed });
}

/**
 * Word-level diff of two lines.
 * @returns {{left: {text: string, changed: boolean}[], right: {text: string, changed: boolean}[]}}
 */
export function diffWords(oldText, newText) {
    const whole = () => ({
        left: oldText ? [{ text: oldText, changed: true }] : [],
        right: newText ? [{ text: newText, changed: true }] : []
    });
    const a = oldText.match(TOKEN_RE) ?? [];
    const b = newText.match(TOKEN_RE) ?? [];
    let s = 0;
    while (s < a.length && s < b.length && a[s] === b[s]) s++;
    let ea = a.length;
    let eb = b.length;
    while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) {
        ea--;
        eb--;
    }
    const ma = a.slice(s, ea);
    const mb = b.slice(s, eb);
    if ((ma.length + 1) * (mb.length + 1) > MAX_TOKEN_CELLS) return whole();

    // LCS table over the differing middle
    const w = mb.length + 1;
    const table = new Uint16Array((ma.length + 1) * w);
    for (let i = ma.length - 1; i >= 0; i--) {
        for (let j = mb.length - 1; j >= 0; j--) {
            table[i * w + j] =
                ma[i] === mb[j]
                    ? table[(i + 1) * w + j + 1] + 1
                    : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
        }
    }
    const left = [];
    const right = [];
    let sharedChars = 0;
    for (let i = 0; i < s; i++) {
        pushSegment(left, a[i], false);
        pushSegment(right, b[i], false);
        sharedChars += a[i].length;
    }
    let i = 0;
    let j = 0;
    while (i < ma.length && j < mb.length) {
        if (ma[i] === mb[j]) {
            pushSegment(left, ma[i], false);
            pushSegment(right, mb[j], false);
            sharedChars += ma[i].length;
            i++;
            j++;
        } else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) {
            pushSegment(left, ma[i++], true);
        } else {
            pushSegment(right, mb[j++], true);
        }
    }
    while (i < ma.length) pushSegment(left, ma[i++], true);
    while (j < mb.length) pushSegment(right, mb[j++], true);
    for (let t = ea; t < a.length; t++) {
        pushSegment(left, a[t], false);
        pushSegment(right, b[eb + t - ea], false);
        sharedChars += a[t].length;
    }
    const longest = Math.max(oldText.length, newText.length);
    if (longest > 0 && sharedChars / longest < MIN_SIMILARITY) return whole();
    return { left, right };
}

const plain = (text) => (text === '' ? [] : [{ text, changed: false }]);
const changedWhole = (text) => (text === '' ? [] : [{ text, changed: true }]);

/**
 * Build side-by-side rows from a line diff. Runs of removals followed by
 * additions are paired up (type 'change') with intra-line segments.
 * Row: { type: 'equal'|'change'|'del'|'add', hunk, left, right }
 * where left/right are null or { no, text, segments }.
 */
export function buildRows(oldLines, newLines, ops) {
    const rows = [];
    let hunk = -1;
    let i = 0;
    while (i < ops.length) {
        if (ops[i].t === 'eq') {
            const text = oldLines[ops[i].a];
            rows.push({
                type: 'equal',
                hunk: -1,
                left: { no: ops[i].a + 1, text, segments: plain(text) },
                right: { no: ops[i].b + 1, text, segments: plain(text) }
            });
            i++;
            continue;
        }
        hunk++;
        const dels = [];
        const adds = [];
        while (i < ops.length && ops[i].t !== 'eq') {
            (ops[i].t === 'del' ? dels : adds).push(ops[i]);
            i++;
        }
        const useWords =
            Math.min(dels.length, adds.length) <= MAX_PAIRS_FOR_WORD_DIFF;
        const count = Math.max(dels.length, adds.length);
        for (let r = 0; r < count; r++) {
            const d = dels[r];
            const a = adds[r];
            const lt = d ? oldLines[d.a] : null;
            const rt = a ? newLines[a.b] : null;
            let lseg = d ? changedWhole(lt) : null;
            let rseg = a ? changedWhole(rt) : null;
            if (
                d &&
                a &&
                useWords &&
                lt.length <= MAX_LINE_LENGTH_FOR_WORD_DIFF &&
                rt.length <= MAX_LINE_LENGTH_FOR_WORD_DIFF
            ) {
                ({ left: lseg, right: rseg } = diffWords(lt, rt));
            }
            rows.push({
                type: d && a ? 'change' : d ? 'del' : 'add',
                hunk,
                left: d ? { no: d.a + 1, text: lt, segments: lseg } : null,
                right: a ? { no: a.b + 1, text: rt, segments: rseg } : null
            });
        }
    }
    return rows;
}

/**
 * Collapse long runs of equal rows. A fold's id is the index (in `rows`) of
 * its first hidden row, so it stays stable while other folds open and close.
 * @returns {Array} rows and folds ({type: 'fold', id, count, rows})
 */
export function foldRows(rows, context = 3, expanded = new Set(), minFold = 2) {
    const out = [];
    let i = 0;
    while (i < rows.length) {
        if (rows[i].type !== 'equal') {
            out.push(rows[i++]);
            continue;
        }
        let j = i;
        while (j < rows.length && rows[j].type === 'equal') j++;
        const before = i === 0 ? 0 : context;
        const after = j === rows.length ? 0 : context;
        const hidden = j - i - before - after;
        const allEqual = i === 0 && j === rows.length;
        if (allEqual || hidden < minFold || expanded.has(i + before)) {
            for (let k = i; k < j; k++) out.push(rows[k]);
        } else {
            for (let k = i; k < i + before; k++) out.push(rows[k]);
            out.push({
                type: 'fold',
                id: i + before,
                count: hidden,
                rows: rows.slice(i + before, j - after)
            });
            for (let k = j - after; k < j; k++) out.push(rows[k]);
        }
        i = j;
    }
    return out;
}

/**
 * Flatten side-by-side rows into unified rows (all removals of a hunk before
 * its additions). Row: { type: 'equal'|'del'|'add', hunk, oldNo, newNo, text,
 * segments }. Fold rows pass through untouched.
 */
export function toUnified(rows) {
    const out = [];
    let adds = [];
    const flush = () => {
        out.push(...adds);
        adds = [];
    };
    rows.forEach((row) => {
        if (row.type === 'fold') {
            flush();
            out.push(row);
        } else if (row.type === 'equal') {
            flush();
            out.push({
                type: 'equal',
                hunk: -1,
                oldNo: row.left.no,
                newNo: row.right.no,
                text: row.left.text,
                segments: row.left.segments
            });
        } else {
            if (adds.length && adds[0].hunk !== row.hunk) flush();
            if (row.left) {
                out.push({
                    type: 'del',
                    hunk: row.hunk,
                    oldNo: row.left.no,
                    newNo: null,
                    text: row.left.text,
                    segments: row.left.segments
                });
            }
            if (row.right) {
                adds.push({
                    type: 'add',
                    hunk: row.hunk,
                    oldNo: null,
                    newNo: row.right.no,
                    text: row.right.text,
                    segments: row.right.segments
                });
            }
        }
    });
    flush();
    return out;
}

/** @returns {{added: number, removed: number, hunks: number}} */
export function diffStats(ops) {
    let added = 0;
    let removed = 0;
    let hunks = 0;
    let inHunk = false;
    ops.forEach((op) => {
        if (op.t === 'eq') {
            inHunk = false;
            return;
        }
        if (!inHunk) hunks++;
        inHunk = true;
        if (op.t === 'add') added++;
        else removed++;
    });
    return { added, removed, hunks };
}

/**
 * Default right-hand file: same-named file in another bundle, else the next
 * file after the left one.
 * @param {{id: string, bundle: string, label: string}[]} files
 * @param {string} leftId
 * @returns {string|null} id
 */
export function pickDefaultRight(files, leftId) {
    const left = files.find((f) => f.id === leftId);
    if (!left) return files.length > 1 ? files[1].id : null;
    const slug = (f) => f.label.split('/').pop();
    const sameName = files.find(
        (f) =>
            f.id !== left.id &&
            f.bundle !== left.bundle &&
            slug(f) === slug(left)
    );
    if (sameName) return sameName.id;
    const idx = files.indexOf(left);
    const other = files[idx + 1] ?? files.find((f) => f.id !== left.id);
    return other ? other.id : null;
}
