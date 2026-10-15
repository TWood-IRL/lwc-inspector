import { createElement } from 'lwc';
import ErrorState from 'my/errorState';

const create = (props = {}) => {
    const element = createElement('my-error-state', { is: ErrorState });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
};

describe('my-error-state', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('announces the title and message as an alert', () => {
        const element = create({
            title: 'Unable to load components',
            message: 'Request failed (503)'
        });

        const alert = element.shadowRoot.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        expect(
            element.shadowRoot.querySelector('.error-title').textContent
        ).toBe('Unable to load components');
        expect(
            element.shadowRoot.querySelector('.error-message').textContent
        ).toBe('Request failed (503)');
    });

    it('omits the message paragraph when there is none', () => {
        const element = create();

        expect(element.shadowRoot.querySelector('.error-message')).toBeNull();
        expect(
            element.shadowRoot.querySelector('.error-title').textContent
        ).toBe('Something went wrong');
    });

    it('fires retry when the button is clicked', () => {
        const element = create();
        const handler = jest.fn();
        element.addEventListener('retry', handler);

        element.shadowRoot.querySelector('button.retry').click();

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('supports a custom retry label', () => {
        const element = create({ retryLabel: 'Try again' });

        expect(
            element.shadowRoot.querySelector('button.retry').textContent.trim()
        ).toBe('Try again');
    });
});
