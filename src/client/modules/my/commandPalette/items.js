// Pure builder for the palette result list: no DOM, no LWC.
import { fuzzyScore } from './fuzzy';

export const MAX_RESULTS = 50;
// Without a query, show only a handful of components so actions stay visible
export const EMPTY_QUERY_COMPONENT_LIMIT = 10;

const TYPE_LABEL = { lwcComps: 'LWC', auraComps: 'Aura' };

export const ACTIONS = [
    {
        id: 'toggle-theme',
        label: 'Toggle theme',
        detail: 'Switch between light and dark',
        keywords: 'dark light mode appearance'
    },
    {
        id: 'copy-link',
        label: 'Copy link',
        detail: 'Copy a deep link to this view',
        keywords: 'share url'
    },
    {
        id: 'copy-source',
        label: 'Copy source',
        detail: 'Copy the open file',
        keywords: 'clipboard code',
        needsSource: true
    },
    {
        id: 'show-shortcuts',
        label: 'Show keyboard shortcuts',
        detail: 'Open the cheat sheet',
        keywords: 'help keys hotkeys'
    }
];

/**
 * Sections in default order. `order` is used to break score ties when
 * sections are ranked by their best match.
 */
const SECTIONS = [
    { id: 'components', label: 'Components' },
    { id: 'files', label: 'Files in this component' },
    { id: 'recent', label: 'Recent' },
    { id: 'actions', label: 'Actions' }
];
const EMPTY_ORDER = ['recent', 'files', 'actions', 'components'];

function match(query, label, extra) {
    const direct = fuzzyScore(query, label);
    if (direct) return direct;
    if (extra) {
        // Keyword match ranks below any label match and is not highlighted
        const other = fuzzyScore(query, extra);
        if (other) return { score: other.score - 100, indices: [] };
    }
    return null;
}

function candidates(data, recents) {
    const typeLabel = (type) => TYPE_LABEL[type] ?? '';
    const bundles = data?.bundles ?? [];
    const files = data?.files ?? [];
    return {
        components: bundles.map((b) => ({
            label: b.label,
            detail: typeLabel(b.type),
            kind: 'component',
            key: `${b.type}:${b.label}`,
            payload: { type: b.type, bundle: b.label, file: null }
        })),
        files: files.map((f) => ({
            label: f.file,
            detail: f.bundle,
            kind: 'file',
            key: `${f.type}:${f.bundle}/${f.file}`,
            payload: { type: f.type, bundle: f.bundle, file: f.file }
        })),
        recent: (recents ?? []).map((r) => ({
            label: r.label || r.name,
            detail: typeLabel(r.type),
            kind: 'recent',
            key: `${r.type}:${r.name}`,
            payload: { type: r.type, bundle: r.name, file: null }
        })),
        actions: ACTIONS.filter(
            (a) => !a.needsSource || data?.canCopySource
        ).map((a) => ({
            label: a.label,
            detail: a.detail,
            extra: a.keywords,
            kind: 'action',
            key: a.id,
            payload: { action: a.id }
        }))
    };
}

/**
 * @param {{bundles?:Array, files?:Array, canCopySource?:boolean}} data
 * @param {Array} recents navState entries
 * @param {string} query
 * @returns {Array<{id:string,label:string,items:Array}>} non-empty sections,
 * capped to MAX_RESULTS items in total.
 */
export function buildSections(data, recents, query) {
    const q = String(query ?? '').trim();
    const all = candidates(data, recents);
    let scored = SECTIONS.map((section, order) => {
        let items = all[section.id]
            .map((item, i) => {
                const m = q ? match(q, item.label, item.extra) : null;
                if (q && !m) return null;
                return {
                    ...item,
                    section: section.id,
                    indices: m?.indices ?? [],
                    score: m?.score ?? 0,
                    pos: i
                };
            })
            .filter(Boolean);
        if (q) {
            items.sort((a, b) => b.score - a.score || a.pos - b.pos);
        } else if (section.id === 'components') {
            items = items.slice(0, EMPTY_QUERY_COMPONENT_LIMIT);
        }
        return { ...section, order, items, best: items[0]?.score ?? -Infinity };
    }).filter((s) => s.items.length > 0);

    if (q) {
        scored.sort((a, b) => b.best - a.best || a.order - b.order);
    } else {
        scored.sort(
            (a, b) => EMPTY_ORDER.indexOf(a.id) - EMPTY_ORDER.indexOf(b.id)
        );
    }

    // Cap total, trimming from the least relevant section first
    let remaining = MAX_RESULTS;
    scored = scored
        .map((s) => {
            const items = s.items.slice(0, Math.max(remaining, 0));
            remaining -= items.length;
            return { id: s.id, label: s.label, items };
        })
        .filter((s) => s.items.length > 0);
    return scored;
}
