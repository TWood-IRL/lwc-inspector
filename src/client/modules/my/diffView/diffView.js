import { LightningElement, api } from 'lwc';
import {
    splitLines,
    diffLines,
    buildRows,
    foldRows,
    toUnified,
    diffStats,
    pickDefaultRight
} from './diff';

const CONTEXT_LINES = 3;
const NARROW_QUERY = '(max-width: 768px)';

const unchangedLabel = (count) =>
    `${count} unchanged ${count === 1 ? 'line' : 'lines'}`;

export default class DiffView extends LightningElement {
    _files = [];
    _initialLeft;
    leftId = null;
    rightId = null;
    mode = 'split';
    narrow = false;
    currentHunk = -1;
    expanded = new Set();
    _cache = null;
    _focused = false;
    _scrollToHunk = false;

    /**
     * Loaded files: { id, bundle, label, source }
     * @type {Array}
     */
    @api
    get files() {
        return this._files;
    }
    set files(value) {
        this._files = Array.isArray(value) ? value : [];
        this.ensureSelection();
    }

    /** Id of the file to start with on the left (the file open in the viewer) */
    @api
    get initialLeft() {
        return this._initialLeft;
    }
    set initialLeft(value) {
        this._initialLeft = value;
        this.ensureSelection();
    }

    connectedCallback() {
        if (typeof window.matchMedia === 'function') {
            this._mql = window.matchMedia(NARROW_QUERY);
            this.narrow = !!this._mql.matches;
            this._mqlHandler = (event) => {
                this.narrow = !!event.matches;
            };
            this._mql.addEventListener?.('change', this._mqlHandler);
        }
        this.ensureSelection();
    }

    disconnectedCallback() {
        this._mql?.removeEventListener?.('change', this._mqlHandler);
    }

    renderedCallback() {
        if (!this._focused) {
            this._focused = true;
            this.template.querySelector('.diff-root')?.focus();
        }
        if (this._scrollToHunk) {
            this._scrollToHunk = false;
            const row = this.template.querySelector(
                `tr[data-hunk-start="${this.currentHunk}"]`
            );
            if (row && typeof row.scrollIntoView === 'function') {
                row.scrollIntoView({ block: 'center' });
            }
        }
    }

    ensureSelection() {
        const files = this._files;
        if (!files.some((f) => f.id === this.leftId)) {
            this.leftId = files.some((f) => f.id === this._initialLeft)
                ? this._initialLeft
                : (files[0]?.id ?? null);
            this.rightId = null;
        }
        if (!files.some((f) => f.id === this.rightId)) {
            this.rightId = pickDefaultRight(files, this.leftId);
            this.resetPosition();
        }
    }

    resetPosition() {
        this.currentHunk = -1;
        this.expanded = new Set();
    }

    // --- Model ---------------------------------------------------------

    get leftFile() {
        return this._files.find((f) => f.id === this.leftId);
    }
    get rightFile() {
        return this._files.find((f) => f.id === this.rightId);
    }
    get ready() {
        return !!(this.leftFile && this.rightFile);
    }

    // Diffing is the expensive part, so it is cached per pair of sources
    get model() {
        const left = this.leftFile;
        const right = this.rightFile;
        if (!left || !right) return null;
        const cache = this._cache;
        if (
            cache &&
            cache.leftSource === left.source &&
            cache.rightSource === right.source
        ) {
            return cache;
        }
        const oldLines = splitLines(left.source);
        const newLines = splitLines(right.source);
        const { ops, coarse } = diffLines(oldLines, newLines);
        this._cache = {
            leftSource: left.source,
            rightSource: right.source,
            rows: buildRows(oldLines, newLines, ops),
            stats: diffStats(ops),
            coarse
        };
        return this._cache;
    }

    get stats() {
        return this.model?.stats ?? { added: 0, removed: 0, hunks: 0 };
    }
    get identical() {
        return this.ready && this.stats.hunks === 0;
    }
    get hasChanges() {
        return this.ready && this.stats.hunks > 0;
    }
    get coarse() {
        return !!this.model?.coarse;
    }
    get addedLabel() {
        return `+${this.stats.added}`;
    }
    get removedLabel() {
        return `−${this.stats.removed}`;
    }
    get statsAria() {
        const { added, removed } = this.stats;
        return `${added} ${added === 1 ? 'line' : 'lines'} added, ${removed} ${
            removed === 1 ? 'line' : 'lines'
        } removed`;
    }
    get changeStatus() {
        const { hunks } = this.stats;
        if (hunks === 0) return 'No changes';
        const position = this.currentHunk < 0 ? '-' : this.currentHunk + 1;
        return `Change ${position} of ${hunks}`;
    }
    get noChanges() {
        return !this.hasChanges;
    }

    // --- Pickers -------------------------------------------------------

    buildGroups(selectedId) {
        const groups = [];
        const byBundle = new Map();
        this._files.forEach((file) => {
            if (!byBundle.has(file.bundle)) {
                const group = {
                    key: `g-${groups.length}`,
                    label: file.bundle,
                    options: []
                };
                byBundle.set(file.bundle, group);
                groups.push(group);
            }
            byBundle.get(file.bundle).options.push({
                id: file.id,
                label: file.label.split('/').pop(),
                selected: file.id === selectedId
            });
        });
        return groups;
    }
    get leftGroups() {
        return this.buildGroups(this.leftId);
    }
    get rightGroups() {
        return this.buildGroups(this.rightId);
    }
    get hasFiles() {
        return this._files.length > 0;
    }
    get noFiles() {
        return !this.hasFiles;
    }
    get needsRight() {
        return this.hasFiles && !this.rightFile;
    }

    handleLeftChange(event) {
        this.leftId = event.target.value;
        this.resetPosition();
    }
    handleRightChange(event) {
        this.rightId = event.target.value;
        this.resetPosition();
    }
    handleSwap() {
        [this.leftId, this.rightId] = [this.rightId, this.leftId];
        this.resetPosition();
    }
    handleExit() {
        this.dispatchEvent(new CustomEvent('exit'));
    }

    // --- Mode ----------------------------------------------------------

    get isUnified() {
        return this.narrow || this.mode === 'unified';
    }
    get isSplit() {
        return !this.isUnified;
    }
    get showModeToggle() {
        return !this.narrow;
    }
    get splitPressed() {
        return String(this.isSplit);
    }
    get unifiedPressed() {
        return String(this.isUnified);
    }
    get splitClass() {
        return this.isSplit ? 'toggle toggle-active' : 'toggle';
    }
    get unifiedClass() {
        return this.isUnified ? 'toggle toggle-active' : 'toggle';
    }
    handleSplit() {
        this.mode = 'split';
    }
    handleUnified() {
        this.mode = 'unified';
    }

    // --- Navigation ----------------------------------------------------

    step(delta) {
        const { hunks } = this.stats;
        if (!hunks) return;
        let next;
        if (this.currentHunk < 0) {
            next = delta > 0 ? 0 : hunks - 1;
        } else {
            next = (this.currentHunk + delta + hunks) % hunks;
        }
        this.currentHunk = next;
        this._scrollToHunk = true;
    }
    handleNext() {
        this.step(1);
    }
    handlePrev() {
        this.step(-1);
    }
    handleKeydown(event) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const tag = (event.target?.tagName ?? '').toUpperCase();
        if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (event.key === 'n') {
            event.preventDefault();
            this.step(1);
        } else if (event.key === 'p') {
            event.preventDefault();
            this.step(-1);
        }
    }

    handleExpand(event) {
        const id = Number(event.currentTarget.dataset.id);
        this.expanded = new Set(this.expanded).add(id);
    }

    // --- Rows ----------------------------------------------------------

    segments(list, prefix) {
        return (list ?? []).map((seg, i) => ({
            key: `${prefix}-${i}`,
            text: seg.text,
            className: seg.changed ? 'seg seg-changed' : 'seg'
        }));
    }

    foldVm(row) {
        return {
            key: `f${row.id}`,
            isFold: true,
            foldId: row.id,
            label: unchangedLabel(row.count),
            ariaLabel: `Show ${unchangedLabel(row.count)}`
        };
    }

    rowClass(row, side) {
        const classes = ['line', `line-${row.type}`];
        if (side) classes.push(`${side}-${row.type}`);
        if (row.hunk >= 0 && row.hunk === this.currentHunk) {
            classes.push('line-current');
        }
        return classes.join(' ');
    }

    get foldedRows() {
        const model = this.model;
        if (!model || this.identical) return [];
        return foldRows(model.rows, CONTEXT_LINES, this.expanded);
    }

    // Tracks which hunks already had a first row emitted
    get unifiedRows() {
        if (!this.isUnified) return [];
        const seen = new Set();
        return toUnified(this.foldedRows).map((row, i) => {
            if (row.type === 'fold') return this.foldVm(row);
            const start = row.hunk >= 0 && !seen.has(row.hunk);
            if (row.hunk >= 0) seen.add(row.hunk);
            const mark =
                row.type === 'add' ? '+' : row.type === 'del' ? '−' : '';
            const markText =
                row.type === 'add'
                    ? 'added'
                    : row.type === 'del'
                      ? 'removed'
                      : '';
            return {
                key: `u${i}`,
                isFold: false,
                className: this.rowClass(row),
                hunk: row.hunk,
                hunkStart: start ? row.hunk : undefined,
                oldNo: row.oldNo ?? '',
                newNo: row.newNo ?? '',
                mark,
                markText,
                segments: this.segments(row.segments, `u${i}`)
            };
        });
    }

    get splitRows() {
        if (!this.isSplit) return [];
        const seen = new Set();
        return this.foldedRows.map((row, i) => {
            if (row.type === 'fold') return this.foldVm(row);
            const start = row.hunk >= 0 && !seen.has(row.hunk);
            if (row.hunk >= 0) seen.add(row.hunk);
            const side = (cell, kind, mark, markText) => ({
                no: cell ? cell.no : '',
                mark: cell ? mark : '',
                markText: cell ? markText : '',
                className: cell ? `cell cell-${kind}` : 'cell cell-empty',
                segments: this.segments(cell?.segments, `s${i}${kind}`)
            });
            const leftKind = row.type === 'equal' ? 'equal' : 'del';
            const rightKind = row.type === 'equal' ? 'equal' : 'add';
            const left = side(
                row.left,
                leftKind,
                leftKind === 'del' ? '−' : '',
                leftKind === 'del' ? 'removed' : ''
            );
            const right = side(
                row.right,
                rightKind,
                rightKind === 'add' ? '+' : '',
                rightKind === 'add' ? 'added' : ''
            );
            return {
                key: `s${i}`,
                isFold: false,
                className: this.rowClass(row),
                hunk: row.hunk,
                hunkStart: start ? row.hunk : undefined,
                left,
                right
            };
        });
    }
}
