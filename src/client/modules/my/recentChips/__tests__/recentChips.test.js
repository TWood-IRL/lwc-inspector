import { createElement } from 'lwc';
import RecentChips from 'my/recentChips';

const create = (items) => {
    const el = createElement('my-recent-chips', { is: RecentChips });
    el.items = items;
    document.body.appendChild(el);
    return el;
};

describe('my-recent-chips', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders nothing when empty', async () => {
        const el = create([]);
        await Promise.resolve();
        expect(el.shadowRoot.querySelector('.recents')).toBeNull();
    });

    it('renders a button per item and fires select', async () => {
        const el = create([
            { name: 'a', label: 'a', type: 'lwcComps' },
            { name: 'b', label: 'b', type: 'auraComps' }
        ]);
        await Promise.resolve();
        const chips = el.shadowRoot.querySelectorAll('button.chip');
        expect(chips).toHaveLength(2);
        expect(chips[1].textContent).toContain('Aura');
        const handler = jest.fn();
        el.addEventListener('select', handler);
        chips[1].click();
        expect(handler.mock.calls[0][0].detail).toEqual({
            name: 'b',
            type: 'auraComps'
        });
    });

    it('fires clear', async () => {
        const el = create([{ name: 'a', label: 'a', type: 'lwcComps' }]);
        await Promise.resolve();
        const handler = jest.fn();
        el.addEventListener('clear', handler);
        el.shadowRoot.querySelector('button.clear').click();
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
