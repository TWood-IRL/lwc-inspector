import {
    parseHash,
    buildHash,
    loadRecents,
    addRecent,
    clearRecents,
    RECENTS_KEY,
    MAX_RECENTS
} from 'my/navState';

const memoryStorage = (initial = {}) => {
    const data = { ...initial };
    return {
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => {
            data[k] = v;
        },
        removeItem: (k) => {
            delete data[k];
        }
    };
};

describe('hash parse/build', () => {
    it('parses bundle and file', () => {
        expect(parseHash('#/lwc/myComp/myComp.js')).toEqual({
            type: 'lwcComps',
            bundle: 'myComp',
            file: 'myComp.js'
        });
    });
    it('parses a bundle-only aura link', () => {
        expect(parseHash('#/aura/myAura')).toEqual({
            type: 'auraComps',
            bundle: 'myAura',
            file: null
        });
    });
    it.each(['', '#', '#/', '#/lwc', '#/foo/bar', '#/lwc/a/b/c', '#/lwc//x'])(
        'returns null for %p',
        (hash) => {
            expect(parseHash(hash)).toBeNull();
        }
    );
    it('returns null for non-strings and bad encoding', () => {
        expect(parseHash(undefined)).toBeNull();
        expect(parseHash('#/lwc/%E0%A4%A')).toBeNull();
    });
    it('round-trips encoded names', () => {
        const target = { type: 'lwcComps', bundle: 'a b', file: 'a b.js' };
        const hash = buildHash(target);
        expect(hash).toBe('#/lwc/a%20b/a%20b.js');
        expect(parseHash(hash)).toEqual(target);
    });
    it('builds without a file and rejects invalid targets', () => {
        expect(buildHash({ type: 'auraComps', bundle: 'x' })).toBe('#/aura/x');
        expect(buildHash({ type: 'nope', bundle: 'x' })).toBe('');
        expect(buildHash()).toBe('');
    });
});

describe('recents store', () => {
    const entry = (n, type = 'lwcComps') => ({ name: n, label: n, type });

    it('starts empty', () => {
        expect(loadRecents(memoryStorage())).toEqual([]);
    });
    it('adds most recent first and dedupes', () => {
        const s = memoryStorage();
        addRecent(entry('a'), s);
        addRecent(entry('b'), s);
        const items = addRecent(entry('a'), s);
        expect(items.map((i) => i.name)).toEqual(['a', 'b']);
        expect(loadRecents(s)).toEqual(items);
    });
    it('treats same name with a different type as distinct', () => {
        const s = memoryStorage();
        addRecent(entry('a'), s);
        expect(addRecent(entry('a', 'auraComps'), s)).toHaveLength(2);
    });
    it('caps the list', () => {
        const s = memoryStorage();
        for (let i = 0; i < MAX_RECENTS + 3; i++) {
            addRecent(entry(`c${i}`), s);
        }
        const items = loadRecents(s);
        expect(items).toHaveLength(MAX_RECENTS);
        expect(items[0].name).toBe(`c${MAX_RECENTS + 2}`);
    });
    it('ignores invalid entries and corrupt or old-version data', () => {
        expect(
            addRecent({ name: '', type: 'lwcComps' }, memoryStorage())
        ).toEqual([]);
        expect(
            loadRecents(memoryStorage({ [RECENTS_KEY]: 'not json' }))
        ).toEqual([]);
        expect(
            loadRecents(
                memoryStorage({
                    [RECENTS_KEY]: JSON.stringify({ v: 0, items: [entry('a')] })
                })
            )
        ).toEqual([]);
        expect(
            loadRecents(
                memoryStorage({
                    [RECENTS_KEY]: JSON.stringify({
                        v: 1,
                        items: [entry('a'), { bad: true }]
                    })
                })
            )
        ).toEqual([entry('a')]);
    });
    it('clears', () => {
        const s = memoryStorage();
        addRecent(entry('a'), s);
        expect(clearRecents(s)).toEqual([]);
        expect(loadRecents(s)).toEqual([]);
    });
    it('survives a throwing storage', () => {
        const boom = () => {
            throw new Error('x');
        };
        const bad = { getItem: boom, setItem: boom, removeItem: boom };
        expect(loadRecents(bad)).toEqual([]);
        expect(() => addRecent(entry('a'), bad)).not.toThrow();
        expect(() => clearRecents(bad)).not.toThrow();
    });
});
