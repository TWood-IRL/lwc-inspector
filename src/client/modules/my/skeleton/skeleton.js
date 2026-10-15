import { LightningElement, api } from 'lwc';

// Widths (percent) cycle so the placeholder rows look like real text
const TREE_WIDTHS = [72, 55, 84, 63, 48, 78, 58, 69];
const CODE_WIDTHS = [38, 82, 64, 0, 71, 46, 90, 52, 33, 77, 0, 60];

export default class Skeleton extends LightningElement {
    /** 'tree' (default) or 'code' */
    @api variant = 'tree';
    @api rows = 8;
    @api label = 'Loading';

    get isCode() {
        return this.variant === 'code';
    }

    get lines() {
        const widths = this.isCode ? CODE_WIDTHS : TREE_WIDTHS;
        const count = Math.max(1, Math.min(Number(this.rows) || 1, 30));
        return Array.from({ length: count }, (_, i) => {
            const width = widths[i % widths.length];
            return {
                key: i,
                className: width === 0 ? 'line gap' : 'line',
                style: `width:${width}%`
            };
        });
    }

    get containerClass() {
        return this.isCode
            ? 'skeleton skeleton-code'
            : 'skeleton skeleton-tree';
    }
}
