import {
    setScope,
    getScope,
    clear,
    get,
    set,
    remove,
    age,
    formatAge,
    MAX_ENTRIES,
    MAX_ENTRY_CHARS
} from 'data/cache';

describe('data/cache', () => {
    beforeEach(() => {
        sessionStorage.clear();
        setScope(null);
        clear();
    });

    it('returns null for unknown keys', () => {
        expect(get('nope')).toBeNull();
    });

    it('stores copies so callers cannot mutate cached data', () => {
        setScope('org:user');
        const value = { data: [{ id: 1 }] };
        set('k', value);
        value.data.push({ id: 2 });

        const first = get('k');
        first.value.data[0].id = 99;

        expect(get('k').value).toEqual({ data: [{ id: 1 }] });
    });

    it('persists to sessionStorage and survives a memory reset', () => {
        setScope('org:user');
        set('k', { a: 1 }, 1234);

        // simulate a page reload: fresh module state, same sessionStorage
        jest.isolateModules(() => {
            // eslint-disable-next-line no-undef
            const fresh = require('data/cache');
            expect(fresh.get('k')).toBeNull(); // no scope yet, nothing read
            fresh.setScope('org:user');
            expect(fresh.get('k')).toEqual({ value: { a: 1 }, ts: 1234 });
        });
    });

    it('does not persist before a scope is set', () => {
        set('k', { a: 1 });

        expect(sessionStorage.length).toBe(0);
    });

    it('never exposes one scope to another', () => {
        setScope('orgA:user1');
        set('k', { secret: true });

        setScope('orgB:user2');

        expect(get('k')).toBeNull();
        expect(getScope()).toBe('orgB:user2');
        // the old org's persisted data is purged too
        expect(sessionStorage.length).toBe(0);
        setScope('orgA:user1');
        expect(get('k')).toBeNull();
    });

    it('clear() removes memory and persisted entries', () => {
        setScope('s');
        set('a', 1);
        set('b', 2);

        clear();

        expect(get('a')).toBeNull();
        expect(sessionStorage.length).toBe(0);
    });

    it('remove() drops a single key', () => {
        setScope('s');
        set('a', 1);
        set('b', 2);

        remove('a');

        expect(get('a')).toBeNull();
        expect(get('b').value).toBe(2);
    });

    it('caps the number of entries, evicting the oldest', () => {
        setScope('s');
        for (let i = 0; i < MAX_ENTRIES + 5; i++) set(`k${i}`, i);

        expect(get('k0')).toBeNull();
        expect(get('k4')).toBeNull();
        expect(get('k5').value).toBe(5);
        expect(get(`k${MAX_ENTRIES + 4}`).value).toBe(MAX_ENTRIES + 4);
    });

    it('keeps oversized entries in memory only', () => {
        setScope('s');
        set('big', 'x'.repeat(MAX_ENTRY_CHARS + 1));

        expect(sessionStorage.length).toBe(0);
        expect(get('big').value.length).toBe(MAX_ENTRY_CHARS + 1);
    });

    it('survives storage quota errors', () => {
        setScope('s');
        set('old', 1);
        const spy = jest
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

        expect(() => set('new', 2)).not.toThrow();
        spy.mockRestore();

        expect(get('new').value).toBe(2); // still served from memory
        expect(sessionStorage.length).toBe(0); // persisted entries dropped
    });

    it('ignores corrupt persisted entries', () => {
        setScope('s');
        sessionStorage.setItem(
            `lwci:cache:v1:${encodeURIComponent('s')}:bad`,
            '{not json'
        );

        expect(get('bad')).toBeNull();
    });

    it('works when sessionStorage is unavailable', () => {
        const spy = jest
            .spyOn(window, 'sessionStorage', 'get')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        setScope('s');

        expect(() => set('k', 1)).not.toThrow();
        expect(get('k').value).toBe(1);
        expect(() => clear()).not.toThrow();
        spy.mockRestore();
    });

    it('computes ages', () => {
        expect(age(null)).toBe(Infinity);
        expect(age({ ts: 1000 }, 4000)).toBe(3000);
        expect(age({ ts: 5000 }, 4000)).toBe(0);
    });

    it('formats freshness labels', () => {
        const now = 10 * 3600 * 1000;
        expect(formatAge(null, now)).toBe('');
        expect(formatAge(now - 10000, now)).toBe('Updated just now');
        expect(formatAge(now - 3 * 60000, now)).toBe('Updated 3 min ago');
        expect(formatAge(now - 2 * 3600000, now)).toBe('Updated 2 hr ago');
        expect(formatAge(1000, 3 * 86400000 + 1000)).toBe('Updated 3 d ago');
    });
});
