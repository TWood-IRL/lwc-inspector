import { createElement } from 'lwc';
import MyApp from 'my/app';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('my-app', () => {
    beforeEach(() => {
        // The explorer fetches the component list on load; jsdom has no fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            })
        );
    });

    afterEach(() => {
        // The jsdom instance is shared across test cases in a single file so reset the DOM
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete global.fetch;
    });

    it('shows the web explorer when no component is selected', () => {
        const element = createElement('my-app', { is: MyApp });
        document.body.appendChild(element);

        expect(
            element.shadowRoot.querySelector('my-web-explorer')
        ).not.toBeNull();
        expect(element.shadowRoot.querySelector('my-web-component')).toBeNull();
    });

    it('shows the selected component and returns to the explorer on back', async () => {
        const element = createElement('my-app', { is: MyApp });
        document.body.appendChild(element);

        element.shadowRoot
            .querySelector('my-web-explorer')
            .dispatchEvent(
                new CustomEvent('selected', {
                    detail: { id: '0Rb000000000001' }
                })
            );
        await flushPromises();

        expect(element.shadowRoot.querySelector('my-web-explorer')).toBeNull();
        const detail = element.shadowRoot.querySelector('my-web-component');
        expect(detail).not.toBeNull();

        detail.dispatchEvent(new CustomEvent('backselected'));
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('my-web-explorer')
        ).not.toBeNull();
    });
});
