import { createElement } from 'lwc';
import MyGreeting from 'my/greeting';
import { LABELS } from 'data/labelService';

describe('my-greeting', () => {
    afterEach(() => {
        // The jsdom instance is shared across test cases in a single file so reset the DOM
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders one section per about entry', () => {
        const element = createElement('my-greeting', { is: MyGreeting });
        document.body.appendChild(element);

        const headings = [...element.shadowRoot.querySelectorAll('h2')].map(
            (h) => h.textContent.trim()
        );
        expect(headings).toEqual(
            LABELS.ABOUT_HEADERS.map((section) => section.HEADER)
        );
    });

    it('renders the feature list', () => {
        const element = createElement('my-greeting', { is: MyGreeting });
        document.body.appendChild(element);

        const items = element.shadowRoot.querySelectorAll('li');
        expect(items.length).toBe(LABELS.ABOUT_HEADERS[0].LIST.length);
    });

    it('opens reference links in a new tab safely', () => {
        const element = createElement('my-greeting', { is: MyGreeting });
        document.body.appendChild(element);

        const links = element.shadowRoot.querySelectorAll('nav a');
        expect(links.length).toBe(LABELS.ABOUT_LINKS.length);
        links.forEach((link) => {
            expect(link.target).toBe('_blank');
            expect(link.rel).toContain('noopener');
        });
    });
});
