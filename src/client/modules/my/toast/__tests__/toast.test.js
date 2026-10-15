import { createElement } from 'lwc';
import MyToast from 'my/toast';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('my-toast', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    const create = () => {
        const element = createElement('my-toast', { is: MyToast });
        document.body.appendChild(element);
        return element;
    };

    it('renders nothing until a toast is shown', () => {
        const element = create();

        expect(element.shadowRoot.querySelector('h2')).toBeNull();
    });

    it('shows the title and message', async () => {
        const element = create();

        element.showToast({ title: 'Saved', message: 'All good' });
        await flushPromises();

        expect(element.shadowRoot.querySelector('h2').textContent.trim()).toBe(
            'Saved'
        );
        expect(element.shadowRoot.querySelector('p').textContent).toBe(
            'All good'
        );
    });

    it('omits the message paragraph when there is no message', async () => {
        const element = create();

        element.showToast({ title: 'No Results Found' });
        await flushPromises();

        expect(element.shadowRoot.querySelector('h2')).not.toBeNull();
        expect(element.shadowRoot.querySelector('p')).toBeNull();
    });

    it('picks the variant theme', async () => {
        const element = create();

        element.showToast({ title: 'Unable to load component' });
        await flushPromises();
        expect(
            element.shadowRoot.querySelector('.slds-notify').className
        ).toContain('slds-theme_error');

        element.showToast({ title: 'Done', variant: 'success' });
        await flushPromises();
        expect(
            element.shadowRoot.querySelector('.slds-notify').className
        ).toContain('slds-theme_success');
    });
});
