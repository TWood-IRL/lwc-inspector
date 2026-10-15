import { LightningElement, api } from 'lwc';
import { highlight, languageFor, LANGUAGE_LABELS } from './highlight';

/**
 * Read-only, editor-style view of a source file: line numbers, syntax
 * highlighting and a status bar.
 */
export default class CodeViewer extends LightningElement {
    @api code = '';
    @api fileName = '';
    @api format = '';

    renderedKey;

    get language() {
        return languageFor(this.fileName, this.format);
    }
    get languageLabel() {
        return LANGUAGE_LABELS[this.language];
    }
    get lineCount() {
        return (this.code || '').split('\n').length;
    }
    // One block of text, one number per line, so large files stay cheap to render
    get lineNumbers() {
        return Array.from({ length: this.lineCount }, (_, i) => i + 1).join(
            '\n'
        );
    }
    get stats() {
        const lines = this.lineCount;
        return `${lines} ${lines === 1 ? 'line' : 'lines'} · ${(this.code || '').length} characters`;
    }
    get ariaLabel() {
        return `Source of ${this.fileName}`;
    }

    renderedCallback() {
        const code = this.code || '';
        const key = `${this.language}:${code}`;
        if (key === this.renderedKey) {
            return;
        }
        this.renderedKey = key;
        // highlight() returns HTML-escaped markup, so this is safe to insert
        // eslint-disable-next-line @lwc/lwc/no-inner-html
        this.refs.code.innerHTML = highlight(code, this.language);
    }
}
