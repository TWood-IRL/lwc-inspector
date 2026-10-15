import { createElement } from 'lwc';
import MyMain from 'my/main';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const mockWhoAmI = (body) => {
    global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
    );
};

describe('my-main', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete global.fetch;
    });

    const create = async () => {
        const element = createElement('my-main', { is: MyMain });
        document.body.appendChild(element);
        await flushPromises();
        return element;
    };

    it('shows login links and the greeting when logged out', async () => {
        mockWhoAmI({});

        const element = await create();

        const hrefs = [...element.shadowRoot.querySelectorAll('a')].map((a) =>
            a.getAttribute('href')
        );
        expect(hrefs).toContain('/oauth2/login?login_type=SANDBOX');
        expect(element.shadowRoot.querySelector('my-greeting')).not.toBeNull();
        expect(element.shadowRoot.querySelector('my-app')).toBeNull();
    });

    it('shows the app and logout link when logged in', async () => {
        mockWhoAmI({ user_id: '005', display_name: 'Ada Lovelace' });

        const element = await create();

        expect(element.shadowRoot.querySelector('my-app')).not.toBeNull();
        expect(element.shadowRoot.querySelector('my-greeting')).toBeNull();
        expect(
            element.shadowRoot.querySelector('.account-bar').textContent
        ).toContain('Ada Lovelace');
    });

    it('falls back to the logged out view if whoami fails', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const element = await create();

        expect(element.shadowRoot.querySelector('my-app')).toBeNull();
        expect(element.shadowRoot.querySelector('my-greeting')).not.toBeNull();
        console.error.mockRestore();
    });
});
