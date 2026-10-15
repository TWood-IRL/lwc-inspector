import { LightningElement, api } from 'lwc';
import { analyzeBundle } from './analyze';

/**
 * Collapsible, accordion-style panel summarising a component bundle: file
 * stats plus the API surface found by the tolerant analyzer. Clicking an item
 * dispatches `insightselect` with { fileName, line }.
 */
export default class ComponentInsights extends LightningElement {
    _files = [];
    _analysis = analyzeBundle([]);
    panelExpanded = false;
    // Section ids toggled away from their default state
    _toggled = new Set();

    @api
    get files() {
        return this._files;
    }
    set files(value) {
        this._files = Array.isArray(value) ? value : [];
        this._analysis = analyzeBundle(this._files);
    }

    get totals() {
        return this._analysis.totals;
    }
    get fileRows() {
        return this._analysis.files;
    }
    get isEmpty() {
        return this._analysis.files.length === 0;
    }
    get noFindings() {
        return !this.isEmpty && this._analysis.sections.length === 0;
    }
    get summary() {
        const { files, lines, kb } = this._analysis.totals;
        if (!files) return 'No files';
        return `${files} file${files === 1 ? '' : 's'} · ${lines} lines · ${kb} KB`;
    }
    get chevronClass() {
        return this.panelExpanded ? 'chevron chevron-open' : 'chevron';
    }
    get filesExpanded() {
        return this._toggled.has('__files');
    }
    // The first section starts open, the rest closed; toggles flip that
    get viewSections() {
        return this._analysis.sections.map((section, index) => ({
            ...section,
            expanded: this._toggled.has(section.id) !== (index === 0),
            items: section.items.map((item) => ({
                ...item,
                title: `${item.file.split('/').pop()}:${item.line}`
            }))
        }));
    }

    flip(id) {
        const next = new Set(this._toggled);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        this._toggled = next;
    }
    handleTogglePanel() {
        this.panelExpanded = !this.panelExpanded;
    }
    handleToggleSection(event) {
        this.flip(event.currentTarget.dataset.id);
    }
    handleItemClick(event) {
        const { file, line } = event.currentTarget.dataset;
        this.dispatchEvent(
            new CustomEvent('insightselect', {
                detail: { fileName: file, line: Number(line) || 1 }
            })
        );
    }
}
