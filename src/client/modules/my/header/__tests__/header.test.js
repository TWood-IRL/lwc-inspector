import { createElement } from 'lwc';
import Header from 'my/header';

describe('my-header theme toggle', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.matchMedia = jest.fn(() => ({
            matches: false,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        }));
    });
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    const create = () => {
        const element = createElement('my-header', { is: Header });
        document.body.appendChild(element);
        return element;
    };
    const toggle = (el) => el.shadowRoot.querySelector('.theme-toggle');

    it('starts light with aria-pressed=false', () => {
        const el = create();
        expect(toggle(el).getAttribute('aria-pressed')).toBe('false');
        expect(toggle(el).title).toBe('Switch to dark theme');
        expect(document.documentElement.getAttribute('data-theme')).toBe(
            'light'
        );
    });

    it('toggles, persists and applies the theme on click', async () => {
        const el = create();
        toggle(el).click();
        await Promise.resolve();
        expect(toggle(el).getAttribute('aria-pressed')).toBe('true');
        expect(toggle(el).title).toBe('Switch to light theme');
        expect(document.documentElement.getAttribute('data-theme')).toBe(
            'dark'
        );
        expect(window.localStorage.getItem('lwci-theme')).toBe('dark');
    });

    it('restores a stored dark choice', () => {
        window.localStorage.setItem('lwci-theme', 'dark');
        const el = create();
        expect(toggle(el).getAttribute('aria-pressed')).toBe('true');
    });
});
