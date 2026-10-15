import { fuzzyScore, highlightSegments } from '../fuzzy';

const score = (q, t) => fuzzyScore(q, t)?.score;

describe('fuzzyScore', () => {
    it('matches empty query with zero score', () => {
        expect(fuzzyScore('', 'abc')).toEqual({ score: 0, indices: [] });
        expect(fuzzyScore(null, 'abc')).toEqual({ score: 0, indices: [] });
    });
    it('returns null for non subsequences', () => {
        expect(fuzzyScore('xyz', 'abc')).toBeNull();
        expect(fuzzyScore('ba', 'abc')).toBeNull();
        expect(fuzzyScore('abcd', 'abc')).toBeNull();
        expect(fuzzyScore('a', '')).toBeNull();
        expect(fuzzyScore('a'.repeat(41), 'a'.repeat(50))).toBeNull();
    });
    it('is case insensitive and returns indices', () => {
        expect(fuzzyScore('ACC', 'accountList').indices).toEqual([0, 1, 2]);
        expect(fuzzyScore('al', 'accountList').indices).toEqual([0, 7]);
    });
    it('ignores whitespace in the query', () => {
        expect(fuzzyScore('a c', 'abc').indices).toEqual([0, 2]);
    });
    it('rewards consecutive matches', () => {
        expect(score('abc', 'xabcx')).toBeGreaterThan(score('abc', 'xaxbxc'));
    });
    it('rewards word starts', () => {
        expect(score('fb', 'foo-bar')).toBeGreaterThan(score('fb', 'foobar'));
    });
    it('rewards camelCase humps', () => {
        expect(score('ol', 'omniLookup')).toBeGreaterThan(
            score('ol', 'xxoxxlxx')
        );
        expect(score('cl', 'xContactList')).toBeGreaterThan(
            score('cl', 'xcontactlist')
        );
    });
    it('ranks prefix and shorter matches first', () => {
        expect(score('acc', 'account')).toBeGreaterThan(score('acc', 'racc'));
        expect(score('acc', 'acc')).toBeGreaterThan(score('acc', 'account'));
    });
    it('prefers exact case slightly', () => {
        expect(score('A', 'A')).toBeGreaterThan(score('a', 'A'));
    });
    it('finds the best alignment, not the greedy one', () => {
        expect(fuzzyScore('ab', 'xaxxxxxab').indices).toEqual([7, 8]);
    });
});

describe('highlightSegments', () => {
    it('groups matched and unmatched runs', () => {
        expect(highlightSegments('abcd', [0, 1, 3])).toEqual([
            { text: 'ab', match: true, key: 's0' },
            { text: 'c', match: false, key: 's2' },
            { text: 'd', match: true, key: 's3' }
        ]);
    });
    it('returns a single plain segment without indices', () => {
        expect(highlightSegments('abc', [])).toEqual([
            { text: 'abc', match: false, key: 's0' }
        ]);
        expect(highlightSegments('', undefined)).toEqual([]);
    });
    it('keeps markup as inert text', () => {
        const segs = highlightSegments('<b>x</b>', [1]);
        expect(segs.map((s) => s.text).join('')).toBe('<b>x</b>');
    });
});
