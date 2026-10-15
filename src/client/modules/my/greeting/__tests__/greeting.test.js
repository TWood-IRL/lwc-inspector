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

    it('renders the application header', () => {
        const element = createElement('my-greeting', { is: MyGreeting });
        document.body.appendChild(element);

        const header = element.shadowRoot.querySelector('h1');
        expect(header.textContent.trim()).toBe(LABELS.HEADER);
    });

    it('renders one section per about entry', () => {
        const element = createElement('my-greeting', { is: MyGreeting });
        document.body.appendChild(element);

        const sections = element.shadowRoot.querySelectorAll('ul');
        expect(sections.length).toBeGreaterThanOrEqual(
            LABELS.ABOUT_HEADERS.length
        );
    });
});
