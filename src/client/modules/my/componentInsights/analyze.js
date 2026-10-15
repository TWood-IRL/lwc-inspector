/* eslint-disable inclusive-language/use-inclusive-words -- "master" is the Salesforce metadata tag name */
/**
 * Pure, dependency-free analysis of Lightning component bundle sources.
 * Tolerant by design: every exported function swallows malformed input and
 * returns empty results instead of throwing. Line numbers are 1-based.
 */

const LIFECYCLE = [
    'constructor',
    'connectedCallback',
    'disconnectedCallback',
    'renderedCallback',
    'errorCallback',
    'render'
];

const str = (value) => (typeof value === 'string' ? value : '');

// Replace every char except newlines with a space, keeping offsets and lines
const blank = (text) => text.replace(/[^\n]/g, ' ');

/** Blank out JS comments (keeping strings and templates intact). */
export function stripJsComments(source) {
    const s = str(source);
    let out = '';
    let i = 0;
    const n = s.length;
    while (i < n) {
        const c = s[i];
        const d = s[i + 1];
        if (c === '/' && d === '/') {
            let j = i;
            while (j < n && s[j] !== '\n') j++;
            out += blank(s.slice(i, j));
            i = j;
        } else if (c === '/' && d === '*') {
            let j = s.indexOf('*/', i + 2);
            j = j === -1 ? n : j + 2;
            out += blank(s.slice(i, j));
            i = j;
        } else if (c === '"' || c === "'" || c === '`') {
            let j = i + 1;
            while (j < n && s[j] !== c) {
                if (s[j] === '\\') j++;
                // Unterminated quoted strings end at the newline
                else if (c !== '`' && s[j] === '\n') break;
                j++;
            }
            out += s.slice(i, Math.min(j + 1, n));
            i = j + 1;
        } else {
            out += c;
            i++;
        }
    }
    return out;
}

/** Blank out <!-- --> comments in markup / XML. */
export function stripMarkupComments(source) {
    return str(source).replace(/<!--[\s\S]*?(?:-->|$)/g, blank);
}

// Builds an offset -> 1-based line lookup for a text
const lineIndex = (text) => {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === 10) starts.push(i + 1);
    }
    return (offset) => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
};

// Returns the text between a '(' at `open` and its matching ')'
const balanced = (text, open) => {
    let depth = 0;
    let quote = null;
    for (let i = open; i < text.length; i++) {
        const c = text[i];
        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
        } else if (c === '"' || c === "'" || c === '`') quote = c;
        else if (c === '(') depth++;
        else if (c === ')' && --depth === 0) {
            return { body: text.slice(open + 1, i), end: i };
        }
    }
    return { body: text.slice(open + 1), end: text.length };
};

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

const IMPORT_CATEGORIES = [
    ['@salesforce/label/', 'label'],
    ['@salesforce/schema', 'schema'],
    ['@salesforce/apex', 'apex'],
    ['@salesforce/', 'salesforce'],
    ['lightning/', 'lightning'],
    ['c/', 'component']
];

export function analyzeJs(source) {
    const result = {
        extends: null,
        className: null,
        api: [],
        wires: [],
        imports: [],
        lifecycle: [],
        events: []
    };
    try {
        const code = stripJsComments(source);
        const lineOf = lineIndex(code);
        let m;

        const cls =
            /\bclass\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*(?:\([^)]*\))?))?/.exec(
                code
            );
        if (cls) {
            result.className = cls[1];
            result.extends = cls[2] || null;
        }

        // imports: default, named, namespace and side-effect forms
        const importRe =
            /\bimport\s*(?:([\s\S]*?)\s*from\s*)?(['"])([^'"\n]+)\2/g;
        while ((m = importRe.exec(code))) {
            const specifier = m[3];
            const hit = IMPORT_CATEGORIES.find(([prefix]) =>
                specifier.startsWith(prefix)
            );
            result.imports.push({
                specifier,
                category: hit ? hit[1] : 'module',
                binding: m[1] ? collapse(m[1]) : '',
                line: lineOf(m.index)
            });
        }

        // @api members
        const apiRe =
            /@api\b\s*(?:static\s+)?(?:(get|set)\s+(?=[A-Za-z_$]))?(?:async\s+)?([A-Za-z_$][\w$]*)/g;
        while ((m = apiRe.exec(code))) {
            let kind;
            if (m[1] === 'get') kind = 'getter';
            else if (m[1] === 'set') kind = 'setter';
            else {
                const rest = /^\s*(\S)/.exec(code.slice(apiRe.lastIndex));
                kind = rest && rest[1] === '(' ? 'method' : 'property';
            }
            result.api.push({ name: m[2], kind, line: lineOf(m.index) });
        }

        // @wire(adapter, config) target
        const wireRe = /@wire\s*\(/g;
        while ((m = wireRe.exec(code))) {
            const open = m.index + m[0].length - 1;
            const { body, end } = balanced(code, open);
            const adapter = (/^\s*([A-Za-z_$][\w$.]*)/.exec(body) || [])[1];
            const target =
                (/^\s*(?:(?:get|set|async)\s+)?([A-Za-z_$][\w$]*)/.exec(
                    code.slice(end + 1)
                ) || [])[1];
            if (adapter) {
                const comma = body.indexOf(',');
                result.wires.push({
                    adapter,
                    target: target || '',
                    config: comma === -1 ? '' : collapse(body.slice(comma + 1)),
                    line: lineOf(m.index)
                });
            }
            wireRe.lastIndex = Math.max(end, wireRe.lastIndex);
        }

        // lifecycle hooks (method definitions, not calls)
        const hookRe = new RegExp(
            `(?:^|[\\s;{}])(${LIFECYCLE.join('|')})\\s*\\([^)]*\\)\\s*\\{`,
            'g'
        );
        const seen = new Set();
        while ((m = hookRe.exec(code))) {
            if (seen.has(m[1])) continue;
            seen.add(m[1]);
            result.lifecycle.push({
                name: m[1],
                line: lineOf(m.index + m[0].indexOf(m[1]))
            });
        }

        // new CustomEvent('name')
        const evRe = /\bnew\s+CustomEvent\s*\(\s*(['"`])([^'"`\n]*)\1/g;
        while ((m = evRe.exec(code))) {
            result.events.push({ name: m[2], line: lineOf(m.index) });
        }
    } catch {
        // tolerant: return whatever was collected
    }
    return result;
}

const DIRECTIVE_RE =
    /(?:^|[\s"'<])(lwc:[a-z-]+|if:true|if:false|for:each|for:item|for:index|iterator:[A-Za-z_$][\w$]*)(?=[\s=>/]|$)/g;

const attrOf = (text, name) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(text);
    return m ? m[1] : null;
};

export function analyzeHtml(source) {
    const result = {
        components: [],
        slots: [],
        directives: [],
        attributes: []
    };
    try {
        const code = stripMarkupComments(source);
        const lineOf = lineIndex(code);
        let m;

        // c-foo, lightning-card (LWC) and c:foo, lightning:card (Aura)
        const compMap = new Map();
        const tagRe = /<([a-z][a-z0-9]*[-:][A-Za-z0-9_.:-]*)(?=[\s/>]|$)/g;
        while ((m = tagRe.exec(code))) {
            const tag = m[1];
            if (/^aura:/i.test(tag)) continue;
            const existing = compMap.get(tag);
            if (existing) existing.count++;
            else {
                compMap.set(tag, {
                    name: tag,
                    count: 1,
                    line: lineOf(m.index),
                    kind: /^lightning[-:]/.test(tag)
                        ? 'base'
                        : /^c[-:]/.test(tag)
                          ? 'custom'
                          : 'other'
                });
            }
        }
        result.components = [...compMap.values()];

        const slotRe = /<slot\b([^>]*)>/gi;
        while ((m = slotRe.exec(code))) {
            result.slots.push({
                name: attrOf(m[1], 'name') || '(default)',
                line: lineOf(m.index)
            });
        }

        const dirMap = new Map();
        const openTagRe = /<[a-zA-Z][^>]*>/g;
        while ((m = openTagRe.exec(code))) {
            DIRECTIVE_RE.lastIndex = 0;
            let d;
            while ((d = DIRECTIVE_RE.exec(m[0]))) {
                const key = d[1].startsWith('iterator:') ? 'iterator' : d[1];
                const hit = dirMap.get(key);
                if (hit) hit.count++;
                else {
                    dirMap.set(key, {
                        name: key,
                        count: 1,
                        line: lineOf(m.index + d.index)
                    });
                }
            }
        }
        result.directives = [...dirMap.values()];

        const attrRe = /<aura:attribute\b([^>]*)>/gi;
        while ((m = attrRe.exec(code))) {
            const name = attrOf(m[1], 'name');
            if (name) {
                result.attributes.push({
                    name,
                    type: attrOf(m[1], 'type') || '',
                    line: lineOf(m.index)
                });
            }
        }
    } catch {
        // tolerant
    }
    return result;
}

const parseAttrs = (text) => {
    const attrs = {};
    const re = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(text))) attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
    return attrs;
};

const decodeXml = (v) =>
    v
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');

export function analyzeMeta(source) {
    const result = {
        apiVersion: null,
        isExposed: null,
        masterLabel: null,
        description: null,
        targets: [],
        masters: [],
        properties: [],
        lines: {}
    };
    try {
        const code = stripMarkupComments(source);
        const lineOf = lineIndex(code);
        const simple = (tag) => {
            const m = new RegExp(
                `<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`
            ).exec(code);
            return m
                ? { value: decodeXml(m[1].trim()), line: lineOf(m.index) }
                : null;
        };
        const av = simple('apiVersion');
        if (av) {
            result.apiVersion = av.value;
            result.lines.apiVersion = av.line;
        }
        const ex = simple('isExposed');
        if (ex) {
            result.isExposed = ex.value.toLowerCase() === 'true';
            result.lines.isExposed = ex.line;
        }
        const ml = simple('masterLabel');
        if (ml) result.masterLabel = ml.value;
        const ds = simple('description');
        if (ds) result.description = ds.value;

        let m;
        const targetRe = /<target>\s*([^<]*?)\s*<\/target>/g;
        while ((m = targetRe.exec(code))) {
            result.targets.push({
                name: decodeXml(m[1]),
                line: lineOf(m.index)
            });
        }
        const masterRe = /<master>\s*([^<]*?)\s*<\/master>/g;
        while ((m = masterRe.exec(code))) {
            result.masters.push({
                name: decodeXml(m[1]),
                line: lineOf(m.index)
            });
        }
        const propRe = /<property\b([^>]*?)\/?>/g;
        while ((m = propRe.exec(code))) {
            const attrs = parseAttrs(m[1]);
            if (attrs.name) {
                result.properties.push({
                    name: decodeXml(attrs.name),
                    type: attrs.type || '',
                    required: attrs.required === 'true',
                    default: attrs.default !== undefined ? attrs.default : '',
                    label: attrs.label || '',
                    line: lineOf(m.index)
                });
            }
        }
    } catch {
        // tolerant
    }
    return result;
}

/** Classifies a bundle file as js | html | css | meta | cmp | other. */
export function fileKind(file) {
    const f = file || {};
    const label = str(f.label || f.name).toLowerCase();
    if (label.endsWith('-meta.xml')) return 'meta';
    if (label.endsWith('.js')) return 'js';
    if (label.endsWith('.html')) return 'html';
    if (label.endsWith('.css')) return 'css';
    if (/\.(cmp|app|intf)$/.test(label)) return 'cmp';
    if (/\.(evt|design|svg|auradoc)$/.test(label)) return 'other';
    const format = str(f.Format).toUpperCase();
    if (format === 'JS') return 'js';
    if (format === 'CSS') return 'css';
    if (format === 'HTML') return 'html';
    if (format === 'XML') return 'cmp';
    return 'other';
}

const byteLength = (text) => {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c < 0x80) bytes += 1;
        else if (c < 0x800) bytes += 2;
        else if (c >= 0xd800 && c <= 0xdbff) {
            bytes += 4;
            i++;
        } else bytes += 3;
    }
    return bytes;
};

export function countLines(text) {
    const s = str(text);
    if (!s) return 0;
    const n = s.split('\n').length;
    return s.endsWith('\n') ? n - 1 : n;
}

const IMPORT_LABELS = {
    label: 'label',
    schema: 'schema',
    apex: 'apex',
    salesforce: 'salesforce',
    lightning: 'lightning',
    component: 'component',
    module: 'module'
};

const SECTION_ORDER = [
    ['base', 'Base class'],
    ['api', '@api surface'],
    ['wire', '@wire adapters'],
    ['imports', 'Imports'],
    ['lifecycle', 'Lifecycle hooks'],
    ['events', 'Custom events dispatched'],
    ['children', 'Child components'],
    ['slots', 'Slots'],
    ['directives', 'Template directives'],
    ['attributes', 'Aura attributes'],
    ['meta', 'Metadata'],
    ['targets', 'Targets'],
    ['masters', 'Masters'],
    ['properties', 'Design properties']
];

/**
 * Analyzes a whole bundle.
 * @param {Array<{label, name, Source, Format}>} files
 * @returns {{files, totals, sections}} sections are
 *   { id, title, count, items: [{key, text, detail, line, file}] }
 */
export function analyzeBundle(files) {
    const out = {
        files: [],
        totals: { files: 0, lines: 0, bytes: 0, kb: '0.0' },
        sections: []
    };
    try {
        const list = Array.isArray(files) ? files : [];
        const buckets = {};
        const add = (id, file, text, detail, line, extra) => {
            const bucket = (buckets[id] = buckets[id] || []);
            bucket.push({
                key: `${id}:${bucket.length}`,
                file,
                text: String(text),
                detail: detail || '',
                line: line || 1,
                ...extra
            });
        };

        list.forEach((file) => {
            if (!file || typeof file !== 'object') return;
            const source = str(file.Source);
            const id = str(file.name || file.label);
            const label = str(file.label || file.name);
            const kind = fileKind(file);
            const bytes = byteLength(source);
            const lines = countLines(source);
            out.files.push({
                name: id,
                label,
                shortLabel: label.split('/').pop(),
                kind,
                lines,
                bytes,
                kb: (bytes / 1024).toFixed(1)
            });
            out.totals.lines += lines;
            out.totals.bytes += bytes;

            if (kind === 'js') {
                const js = analyzeJs(source);
                if (js.extends) {
                    add(
                        'base',
                        id,
                        js.extends,
                        js.className ? `class ${js.className}` : '',
                        1
                    );
                }
                js.api.forEach((a) => add('api', id, a.name, a.kind, a.line));
                js.wires.forEach((w) =>
                    add(
                        'wire',
                        id,
                        w.adapter,
                        w.target ? `-> ${w.target}` : '',
                        w.line
                    )
                );
                js.imports.forEach((i) =>
                    add(
                        'imports',
                        id,
                        i.specifier,
                        IMPORT_LABELS[i.category],
                        i.line
                    )
                );
                js.lifecycle.forEach((h) =>
                    add('lifecycle', id, h.name, '', h.line)
                );
                js.events.forEach((e) => add('events', id, e.name, '', e.line));
            } else if (kind === 'html' || kind === 'cmp') {
                const html = analyzeHtml(source);
                html.components.forEach((c) =>
                    add(
                        'children',
                        id,
                        c.name,
                        c.count > 1 ? `x${c.count}` : '',
                        c.line
                    )
                );
                html.slots.forEach((s) => add('slots', id, s.name, '', s.line));
                html.directives.forEach((d) =>
                    add(
                        'directives',
                        id,
                        d.name,
                        d.count > 1 ? `x${d.count}` : '',
                        d.line
                    )
                );
                html.attributes.forEach((a) =>
                    add('attributes', id, a.name, a.type, a.line)
                );
            } else if (kind === 'meta') {
                const meta = analyzeMeta(source);
                if (meta.apiVersion !== null) {
                    add(
                        'meta',
                        id,
                        'apiVersion',
                        meta.apiVersion,
                        meta.lines.apiVersion
                    );
                }
                if (meta.isExposed !== null) {
                    add(
                        'meta',
                        id,
                        'isExposed',
                        String(meta.isExposed),
                        meta.lines.isExposed
                    );
                }
                meta.targets.forEach((t) =>
                    add('targets', id, t.name, '', t.line)
                );
                meta.masters.forEach((t) =>
                    add('masters', id, t.name, '', t.line)
                );
                meta.properties.forEach((p) =>
                    add(
                        'properties',
                        id,
                        p.name,
                        [p.type, p.required ? 'required' : '']
                            .filter(Boolean)
                            .join(' '),
                        p.line
                    )
                );
            }
        });

        out.totals.files = out.files.length;
        out.totals.kb = (out.totals.bytes / 1024).toFixed(1);
        out.sections = SECTION_ORDER.filter(([id]) => buckets[id]).map(
            ([id, title]) => ({
                id,
                title,
                count: buckets[id].length,
                items: buckets[id]
            })
        );
    } catch {
        // tolerant: return what we have
    }
    return out;
}
