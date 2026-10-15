import {
    buildSections,
    MAX_RESULTS,
    EMPTY_QUERY_COMPONENT_LIMIT
} from '../items';

const bundles = (n) =>
    Array.from({ length: n }, (_, i) => ({
        label: `comp${i}`,
        type: 'lwcComps'
    }));
const data = {
    bundles: [
        { label: 'accountCard', type: 'lwcComps' },
        { label: 'caseTimeline', type: 'auraComps' }
    ],
    files: [
        { type: 'lwcComps', bundle: 'accountCard', file: 'accountCard.js' },
        { type: 'lwcComps', bundle: 'accountCard', file: 'accountCard.html' }
    ],
    canCopySource: true
};
const recents = [
    { name: 'caseTimeline', label: 'caseTimeline', type: 'auraComps' }
];

const ids = (sections) => sections.map((s) => s.id);
const flat = (sections) => sections.flatMap((s) => s.items);

describe('buildSections', () => {
    it('orders sections for an empty query: recent, files, actions, components', () => {
        const sections = buildSections(data, recents, '');
        expect(ids(sections)).toEqual([
            'recent',
            'files',
            'actions',
            'components'
        ]);
        expect(sections[0].items[0].payload).toEqual({
            type: 'auraComps',
            bundle: 'caseTimeline',
            file: null
        });
    });

    it('limits components when there is no query', () => {
        const sections = buildSections({ bundles: bundles(100) }, [], '');
        const comps = sections.find((s) => s.id === 'components');
        expect(comps.items).toHaveLength(EMPTY_QUERY_COMPONENT_LIMIT);
    });

    it('filters by fuzzy match and exposes highlight indices', () => {
        const sections = buildSections(data, [], 'ac');
        const comp = flat(sections).find((i) => i.kind === 'component');
        expect(comp.label).toBe('accountCard');
        expect(comp.indices).toEqual([0, 1]);
        expect(flat(sections).some((i) => i.label === 'caseTimeline')).toBe(
            false
        );
    });

    it('matches actions by keyword without highlighting', () => {
        const sections = buildSections(data, [], 'dark');
        const items = flat(sections);
        expect(items).toHaveLength(1);
        expect(items[0].payload.action).toBe('toggle-theme');
        expect(items[0].indices).toEqual([]);
    });

    it('ranks sections by their best match', () => {
        const sections = buildSections(data, [], 'copy');
        expect(ids(sections)[0]).toBe('actions');
        const q = buildSections(data, [], 'accountCard.html');
        expect(ids(q)[0]).toBe('files');
    });

    it('sorts items within a section by score', () => {
        const sections = buildSections(
            {
                bundles: [
                    { label: 'xxcxxaxx', type: 'lwcComps' },
                    { label: 'ca', type: 'lwcComps' }
                ]
            },
            [],
            'ca'
        );
        expect(sections[0].items.map((i) => i.label)).toEqual([
            'ca',
            'xxcxxaxx'
        ]);
    });

    it('hides copy source when there is nothing to copy', () => {
        const sections = buildSections(
            { ...data, canCopySource: false },
            [],
            'copy'
        );
        expect(flat(sections).map((i) => i.payload.action)).toEqual([
            'copy-link'
        ]);
    });

    it('caps results at MAX_RESULTS', () => {
        const sections = buildSections({ bundles: bundles(500) }, [], 'comp');
        expect(flat(sections)).toHaveLength(MAX_RESULTS);
    });

    it('copes with missing data', () => {
        expect(ids(buildSections(null, null, ''))).toEqual(['actions']);
        expect(buildSections(null, null, 'zzzzqqq')).toEqual([]);
    });
});
