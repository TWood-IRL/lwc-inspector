import {
    splitLines,
    diffLines,
    diffWords,
    buildRows,
    foldRows,
    toUnified,
    diffStats,
    pickDefaultRight
} from '../diff';

const lines = (text) => splitLines(text);

// Replays ops to prove the diff really transforms a into b
const apply = (a, b, ops) => {
    const out = [];
    ops.forEach((op) => {
        if (op.t === 'eq') {
            expect(a[op.a]).toBe(b[op.b]);
            out.push(a[op.a]);
        } else if (op.t === 'add') {
            out.push(b[op.b]);
        }
    });
    return out;
};

const run = (x, y, options) => {
    const a = lines(x);
    const b = lines(y);
    const result = diffLines(a, b, options);
    return { a, b, ...result };
};

describe('splitLines', () => {
    it('handles empty and nullish input', () => {
        expect(splitLines('')).toEqual([]);
        expect(splitLines(undefined)).toEqual([]);
        expect(splitLines(null)).toEqual([]);
    });
    it('splits on all line endings and ignores one trailing newline', () => {
        expect(splitLines('a\r\nb\rc\nd\n')).toEqual(['a', 'b', 'c', 'd']);
        expect(splitLines('a\n\n')).toEqual(['a', '']);
        expect(splitLines('\n')).toEqual(['']);
    });
});

describe('diffLines', () => {
    it('reports identical input as all equal', () => {
        const { ops, coarse } = run('a\nb\nc', 'a\nb\nc');
        expect(ops.every((op) => op.t === 'eq')).toBe(true);
        expect(ops).toHaveLength(3);
        expect(coarse).toBe(false);
    });

    it('handles empty sides', () => {
        expect(run('', '').ops).toEqual([]);
        expect(run('', 'a\nb').ops.map((o) => o.t)).toEqual(['add', 'add']);
        expect(run('a\nb', '').ops.map((o) => o.t)).toEqual(['del', 'del']);
    });

    it('detects a single insertion, deletion and replacement', () => {
        expect(run('a\nc', 'a\nb\nc').ops.map((o) => o.t)).toEqual([
            'eq',
            'add',
            'eq'
        ]);
        expect(run('a\nb\nc', 'a\nc').ops.map((o) => o.t)).toEqual([
            'eq',
            'del',
            'eq'
        ]);
        expect(run('a\nb\nc', 'a\nX\nc').ops.map((o) => o.t)).toEqual([
            'eq',
            'del',
            'add',
            'eq'
        ]);
    });

    it('returns a minimal diff for a classic Myers example', () => {
        const { a, b, ops } = run('A\nB\nC\nA\nB\nB\nA', 'C\nB\nA\nB\nA\nC');
        const edits = ops.filter((o) => o.t !== 'eq').length;
        expect(edits).toBe(5);
        expect(apply(a, b, ops)).toEqual(b);
    });

    it('keeps indices consistent with the inputs', () => {
        const { a, b, ops } = run('x\ny\nz\nw', 'y\nq\nz\nw\nr');
        let ai = 0;
        let bi = 0;
        const seen = ops.map((op) => {
            const entry = [op.t, op.a, op.b];
            if (op.t !== 'add') ai++;
            if (op.t !== 'del') bi++;
            return entry;
        });
        expect(seen).toEqual([
            ['del', 0, -1],
            ['eq', 1, 0],
            ['add', -1, 1],
            ['eq', 2, 2],
            ['eq', 3, 3],
            ['add', -1, 4]
        ]);
        expect([ai, bi]).toEqual([a.length, b.length]);
    });

    it('matches randomised inputs (apply property and minimality vs LCS)', () => {
        let seed = 7;
        const rand = (n) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        const lcs = (a, b) => {
            const t = Array.from({ length: a.length + 1 }, () =>
                new Array(b.length + 1).fill(0)
            );
            for (let i = a.length - 1; i >= 0; i--) {
                for (let j = b.length - 1; j >= 0; j--) {
                    t[i][j] =
                        a[i] === b[j]
                            ? t[i + 1][j + 1] + 1
                            : Math.max(t[i + 1][j], t[i][j + 1]);
                }
            }
            return t[0][0];
        };
        for (let n = 0; n < 60; n++) {
            const a = Array.from({ length: rand(25) }, () => 'l' + rand(5));
            const b = Array.from({ length: rand(25) }, () => 'l' + rand(5));
            const { ops, coarse } = diffLines(a, b);
            expect(coarse).toBe(false);
            expect(apply(a, b, ops)).toEqual(b);
            const eq = ops.filter((o) => o.t === 'eq').length;
            expect(eq).toBe(lcs(a, b));
        }
    });

    it('trims common prefix and suffix', () => {
        const { ops } = run('h1\nh2\nold\nt1\nt2', 'h1\nh2\nnew\nt1\nt2');
        expect(ops.map((o) => o.t)).toEqual([
            'eq',
            'eq',
            'del',
            'add',
            'eq',
            'eq'
        ]);
    });

    it('falls back to a coarse diff beyond the edit distance cap', () => {
        const { a, b, ops, coarse } = run(
            'a\nb\nc\nd\ne\nf',
            'u\nv\nw\nx\ny\nz',
            { maxDistance: 4 }
        );
        expect(coarse).toBe(true);
        expect(ops.filter((o) => o.t === 'del')).toHaveLength(a.length);
        expect(ops.filter((o) => o.t === 'add')).toHaveLength(b.length);
        expect(apply(a, b, ops)).toEqual(b);
    });

    it('keeps the common ends when the middle is coarse', () => {
        const { ops, coarse } = run('s\n1\n2\n3\n4\ne', 's\n5\n6\n7\n8\ne', {
            maxDistance: 2
        });
        expect(coarse).toBe(true);
        expect(ops[0].t).toBe('eq');
        expect(ops[ops.length - 1].t).toBe('eq');
    });

    it('is fast and exact for ~10k lines with scattered edits', () => {
        const a = Array.from({ length: 10000 }, (_, i) => `line ${i}`);
        const b = a.slice();
        for (let i = 100; i < 10000; i += 500) b[i] = `changed ${i}`;
        b.splice(5000, 0, 'inserted');
        const start = Date.now();
        const { ops, coarse } = diffLines(a, b);
        expect(Date.now() - start).toBeLessThan(5000);
        expect(coarse).toBe(false);
        expect(apply(a, b, ops)).toEqual(b);
        expect(diffStats(ops)).toEqual({
            added: 21,
            removed: 20,
            hunks: 21
        });
    });

    it('stays bounded for 10k totally different lines', () => {
        const a = Array.from({ length: 10000 }, (_, i) => `a${i}`);
        const b = Array.from({ length: 10000 }, (_, i) => `b${i}`);
        const start = Date.now();
        const { ops, coarse } = diffLines(a, b);
        expect(Date.now() - start).toBeLessThan(5000);
        expect(coarse).toBe(true);
        expect(ops).toHaveLength(20000);
    });
});

describe('diffWords', () => {
    const text = (segs) => segs.map((s) => s.text).join('');
    const changed = (segs) => segs.filter((s) => s.changed).map((s) => s.text);

    it('marks only the changed words', () => {
        const { left, right } = diffWords(
            'const total = price * qty;',
            'const total = price * count;'
        );
        expect(text(left)).toBe('const total = price * qty;');
        expect(text(right)).toBe('const total = price * count;');
        expect(changed(left)).toEqual(['qty']);
        expect(changed(right)).toEqual(['count']);
    });

    it('handles pure insertions', () => {
        const { left, right } = diffWords('foo(a)', 'foo(a, b)');
        expect(changed(left)).toEqual([]);
        expect(changed(right).join('')).toBe(', b');
    });

    it('treats whitespace changes as changes', () => {
        const { left, right } = diffWords('a b', 'a  b');
        expect(text(left)).toBe('a b');
        expect(text(right)).toBe('a  b');
        expect(changed(right).length).toBeGreaterThan(0);
    });

    it('highlights the whole line when almost nothing is shared', () => {
        const { left, right } = diffWords('abcdef ghijkl', 'zyxwvu tsrqpo');
        expect(left).toEqual([{ text: 'abcdef ghijkl', changed: true }]);
        expect(right).toEqual([{ text: 'zyxwvu tsrqpo', changed: true }]);
    });

    it('copes with empty strings', () => {
        expect(diffWords('', 'abc')).toEqual({
            left: [],
            right: [{ text: 'abc', changed: true }]
        });
        expect(diffWords('abc', '')).toEqual({
            left: [{ text: 'abc', changed: true }],
            right: []
        });
    });

    it('does not blow up on very long lines', () => {
        const a = Array.from({ length: 800 }, (_, i) => `w${i}`).join(' ');
        const b = Array.from({ length: 800 }, (_, i) => `x${i}`).join(' ');
        const { left } = diffWords(a, b);
        expect(text(left)).toBe(a);
    });

    it('never mangles special characters', () => {
        const { left, right } = diffWords('<b>x</b>', '<i>x</i>');
        expect(text(left)).toBe('<b>x</b>');
        expect(text(right)).toBe('<i>x</i>');
    });
});

describe('buildRows', () => {
    const build = (x, y) => {
        const a = lines(x);
        const b = lines(y);
        return buildRows(a, b, diffLines(a, b).ops);
    };

    it('numbers equal rows on both sides', () => {
        const rows = build('a\nb', 'a\nb');
        expect(rows.map((r) => [r.left.no, r.right.no, r.type])).toEqual([
            [1, 1, 'equal'],
            [2, 2, 'equal']
        ]);
    });

    it('pairs removals with additions into change rows with word segments', () => {
        const rows = build('a\nlet x = 1;\nz', 'a\nlet x = 2;\nz');
        const change = rows[1];
        expect(change.type).toBe('change');
        expect(change.hunk).toBe(0);
        expect(change.left.no).toBe(2);
        expect(change.right.no).toBe(2);
        expect(change.left.segments.filter((s) => s.changed)).toEqual([
            { text: '1', changed: true }
        ]);
        expect(change.right.segments.filter((s) => s.changed)).toEqual([
            { text: '2', changed: true }
        ]);
    });

    it('emits pure add and del rows when the block is lopsided', () => {
        const rows = build('a\nb\nc\nd', 'a\nX\nd');
        expect(rows.map((r) => r.type)).toEqual([
            'equal',
            'change',
            'del',
            'equal'
        ]);
        expect(rows[2].right).toBeNull();
        const grown = build('a\nd', 'a\nX\nY\nd');
        expect(grown.map((r) => r.type)).toEqual([
            'equal',
            'add',
            'add',
            'equal'
        ]);
        expect(grown[1].left).toBeNull();
    });

    it('numbers hunks separately', () => {
        const rows = build('a\nb\nc\nd\ne', 'A\nb\nc\nd\nE');
        expect(
            rows.filter((r) => r.type === 'change').map((r) => r.hunk)
        ).toEqual([0, 1]);
    });

    it('represents blank lines with empty segment lists', () => {
        const rows = build('a\n\nb', 'a\nx\nb');
        expect(rows[1].left.segments).toEqual([]);
        expect(rows[1].right.segments).toEqual([{ text: 'x', changed: true }]);
    });
});

describe('foldRows', () => {
    const equalRows = (n, startNo = 1) =>
        Array.from({ length: n }, (_, i) => ({
            type: 'equal',
            hunk: -1,
            left: { no: startNo + i, text: 't', segments: [] },
            right: { no: startNo + i, text: 't', segments: [] }
        }));
    const change = {
        type: 'change',
        hunk: 0,
        left: { no: 0, text: 'a', segments: [] },
        right: { no: 0, text: 'b', segments: [] }
    };

    it('collapses long unchanged runs but keeps context', () => {
        const rows = [...equalRows(20), change, ...equalRows(20)];
        const out = foldRows(rows, 3);
        const folds = out.filter((r) => r.type === 'fold');
        expect(folds.map((f) => f.count)).toEqual([17, 17]);
        // fold + 3 context, change, 3 context + fold
        expect(out.map((r) => r.type)).toEqual([
            'fold',
            'equal',
            'equal',
            'equal',
            'change',
            'equal',
            'equal',
            'equal',
            'fold'
        ]);
    });

    it('does not fold at the file edges beyond the context', () => {
        const rows = [change, ...equalRows(10)];
        const out = foldRows(rows, 3);
        expect(out.filter((r) => r.type === 'fold')).toHaveLength(1);
        expect(out[0]).toBe(change);
        expect(out).toHaveLength(1 + 3 + 1);
    });

    it('does not fold tiny runs', () => {
        const rows = [change, ...equalRows(7), change];
        // 7 equal rows, context 3+3 leaves a single hidden row: not worth a fold
        expect(foldRows(rows, 3).some((r) => r.type === 'fold')).toBe(false);
        expect(
            foldRows([change, ...equalRows(8), change], 3).some(
                (r) => r.type === 'fold'
            )
        ).toBe(true);
    });

    it('reveals expanded folds by id', () => {
        const rows = [...equalRows(20), change];
        const fold = foldRows(rows, 3).find((r) => r.type === 'fold');
        expect(fold.rows).toHaveLength(fold.count);
        const open = foldRows(rows, 3, new Set([fold.id]));
        expect(open.some((r) => r.type === 'fold')).toBe(false);
        expect(open).toHaveLength(rows.length);
    });

    it('leaves fully identical content unfolded', () => {
        expect(foldRows(equalRows(30), 3)).toHaveLength(30);
    });
});

describe('toUnified', () => {
    it('lists removals before additions within a hunk', () => {
        const a = lines('k\nold1\nold2\nz');
        const b = lines('k\nnew1\nnew2\nz');
        const rows = buildRows(a, b, diffLines(a, b).ops);
        const u = toUnified(rows);
        expect(u.map((r) => r.type)).toEqual([
            'equal',
            'del',
            'del',
            'add',
            'add',
            'equal'
        ]);
        expect(u[1]).toMatchObject({ oldNo: 2, newNo: null, text: 'old1' });
        expect(u[3]).toMatchObject({ oldNo: null, newNo: 2, text: 'new1' });
        expect(u[0]).toMatchObject({ oldNo: 1, newNo: 1 });
    });

    it('does not mix adjacent hunks separated by folds', () => {
        const fold = { type: 'fold', id: 1, count: 5, rows: [] };
        const rows = [
            {
                type: 'change',
                hunk: 0,
                left: { no: 1, text: 'a', segments: [] },
                right: { no: 1, text: 'b', segments: [] }
            },
            fold,
            {
                type: 'add',
                hunk: 1,
                left: null,
                right: { no: 9, text: 'c', segments: [] }
            }
        ];
        const u = toUnified(rows);
        expect(u.map((r) => r.type)).toEqual(['del', 'add', 'fold', 'add']);
    });
});

describe('diffStats', () => {
    it('counts added, removed and hunks', () => {
        const a = lines('a\nb\nc\nd\ne');
        const b = lines('a\nB\nc\nd\ne\nf');
        expect(diffStats(diffLines(a, b).ops)).toEqual({
            added: 2,
            removed: 1,
            hunks: 2
        });
        expect(diffStats(diffLines(a, a).ops)).toEqual({
            added: 0,
            removed: 0,
            hunks: 0
        });
    });
});

describe('pickDefaultRight', () => {
    const files = [
        { id: '1', bundle: 'A', label: 'lwc/A/A.js' },
        { id: '2', bundle: 'A', label: 'lwc/A/A.html' },
        { id: '3', bundle: 'B', label: 'lwc/B/B.js' },
        { id: '4', bundle: 'C', label: 'lwc/C/A.js' }
    ];

    it('prefers a same-named file in another bundle', () => {
        expect(pickDefaultRight(files, '1')).toBe('4');
    });
    it('otherwise picks the next file', () => {
        expect(pickDefaultRight(files, '2')).toBe('3');
        expect(pickDefaultRight(files, '4')).toBe('1');
    });
    it('handles missing selection and single files', () => {
        expect(pickDefaultRight(files, 'nope')).toBe('2');
        expect(pickDefaultRight([files[0]], '1')).toBeNull();
        expect(pickDefaultRight([], 'x')).toBeNull();
    });
});
