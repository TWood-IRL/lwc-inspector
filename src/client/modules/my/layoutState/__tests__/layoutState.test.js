import {
    clamp,
    maxTreeWidth,
    widthForKey,
    loadWidth,
    saveWidth,
    clearWidth,
    loadCollapsed,
    saveCollapsed,
    WIDTH_KEY,
    COLLAPSED_KEY,
    DEFAULT_TREE_WIDTH,
    MIN_TREE_WIDTH,
    MAX_TREE_WIDTH
} from 'my/layoutState';

describe('my/layoutState', () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(() => jest.restoreAllMocks());

    describe('clamp', () => {
        it('bounds values', () => {
            expect(clamp(5, 10, 20)).toBe(10);
            expect(clamp(25, 10, 20)).toBe(20);
            expect(clamp(15, 10, 20)).toBe(15);
        });
        it('falls back to min for non-numbers', () => {
            expect(clamp(NaN, 10, 20)).toBe(10);
            expect(clamp(undefined, 10, 20)).toBe(10);
            expect(clamp(Infinity, 10, 20)).toBe(10);
        });
        it('handles an inverted range', () => {
            expect(clamp(50, 10, 5)).toBe(10);
        });
    });

    describe('maxTreeWidth', () => {
        it('uses the absolute max for unknown containers', () => {
            expect(maxTreeWidth(0)).toBe(MAX_TREE_WIDTH);
            expect(maxTreeWidth(NaN)).toBe(MAX_TREE_WIDTH);
        });
        it('leaves room for the source pane', () => {
            expect(maxTreeWidth(900)).toBe(900 - 320 - 20);
        });
        it('never goes below min or above max', () => {
            expect(maxTreeWidth(400)).toBe(MIN_TREE_WIDTH);
            expect(maxTreeWidth(5000)).toBe(MAX_TREE_WIDTH);
        });
    });

    describe('widthForKey', () => {
        it('steps by 16 and clamps', () => {
            expect(widthForKey('ArrowRight', 300, 200, 600)).toBe(316);
            expect(widthForKey('ArrowLeft', 300, 200, 600)).toBe(284);
            expect(widthForKey('ArrowRight', 598, 200, 600)).toBe(600);
            expect(widthForKey('ArrowLeft', 204, 200, 600)).toBe(200);
        });
        it('supports Home and End', () => {
            expect(widthForKey('Home', 300, 200, 600)).toBe(200);
            expect(widthForKey('End', 300, 200, 600)).toBe(600);
        });
        it('ignores other keys', () => {
            expect(widthForKey('a', 300, 200, 600)).toBeNull();
        });
    });

    describe('width persistence', () => {
        it('defaults when nothing stored', () => {
            expect(loadWidth()).toBe(DEFAULT_TREE_WIDTH);
        });
        it('round trips and rounds', () => {
            saveWidth(333.4);
            expect(window.localStorage.getItem(WIDTH_KEY)).toBe('333');
            expect(loadWidth()).toBe(333);
        });
        it('clamps stored values', () => {
            window.localStorage.setItem(WIDTH_KEY, '5000');
            expect(loadWidth()).toBe(MAX_TREE_WIDTH);
            window.localStorage.setItem(WIDTH_KEY, '1');
            expect(loadWidth()).toBe(MIN_TREE_WIDTH);
        });
        it('defaults on garbage', () => {
            window.localStorage.setItem(WIDTH_KEY, 'abc');
            expect(loadWidth()).toBe(DEFAULT_TREE_WIDTH);
            window.localStorage.setItem(WIDTH_KEY, ' ');
            expect(loadWidth()).toBe(DEFAULT_TREE_WIDTH);
        });
        it('clearWidth removes the value', () => {
            saveWidth(400);
            clearWidth();
            expect(loadWidth()).toBe(DEFAULT_TREE_WIDTH);
        });
        it('survives throwing storage', () => {
            const boom = () => {
                throw new Error('blocked');
            };
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
            jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(
                boom
            );
            expect(loadWidth()).toBe(DEFAULT_TREE_WIDTH);
            expect(loadCollapsed()).toBe(false);
            expect(() => saveWidth(300)).not.toThrow();
            expect(() => clearWidth()).not.toThrow();
            expect(() => saveCollapsed(true)).not.toThrow();
        });
    });

    describe('collapsed persistence', () => {
        it('defaults to expanded', () => {
            expect(loadCollapsed()).toBe(false);
        });
        it('round trips', () => {
            saveCollapsed(true);
            expect(window.localStorage.getItem(COLLAPSED_KEY)).toBe('true');
            expect(loadCollapsed()).toBe(true);
            saveCollapsed(false);
            expect(loadCollapsed()).toBe(false);
        });
    });
});
