import { createElement } from 'lwc';
import Skeleton from 'my/skeleton';

const create = (props = {}) => {
    const element = createElement('my-skeleton', { is: Skeleton });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
};

describe('my-skeleton', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('is a busy status region with an accessible label', () => {
        const element = create({ label: 'Loading components' });

        const region = element.shadowRoot.querySelector('[role="status"]');
        expect(region.getAttribute('aria-busy')).toBe('true');
        expect(region.getAttribute('aria-label')).toBe('Loading components');
        expect(
            element.shadowRoot.querySelector('.visually-hidden').textContent
        ).toBe('Loading components');
    });

    it('renders the requested number of tree rows by default', () => {
        const element = create({ rows: 5 });

        expect(element.shadowRoot.querySelectorAll('.line')).toHaveLength(5);
        expect(
            element.shadowRoot.querySelector('.skeleton-tree')
        ).not.toBeNull();
    });

    it('renders a code block variant', async () => {
        const element = create({ variant: 'code', rows: 12 });
        await Promise.resolve();

        expect(
            element.shadowRoot.querySelector('.skeleton-code')
        ).not.toBeNull();
        expect(element.shadowRoot.querySelectorAll('.line')).toHaveLength(12);
        // blank rows imitate gaps between code blocks
        expect(
            element.shadowRoot.querySelectorAll('.line.gap').length
        ).toBeGreaterThan(0);
    });

    it('hides the decorative lines from assistive tech', () => {
        const element = create({ rows: 3 });

        element.shadowRoot
            .querySelectorAll('.line')
            .forEach((line) =>
                expect(line.getAttribute('aria-hidden')).toBe('true')
            );
    });

    it('clamps the row count to something sensible', () => {
        expect(
            create({ rows: 0 }).shadowRoot.querySelectorAll('.line').length
        ).toBe(1);
        expect(
            create({ rows: 500 }).shadowRoot.querySelectorAll('.line').length
        ).toBe(30);
    });
});
