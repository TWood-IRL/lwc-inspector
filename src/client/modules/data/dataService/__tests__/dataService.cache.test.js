import {
    getLightningComponentBundles,
    getLightningComponentBundleById,
    searchLightningComponentBundle,
    getBundlesUpdatedAt,
    refresh,
    clearCache,
    isAbortError,
    TTL_MS,
    MAX_ATTEMPTS,
    BASE_DELAY_MS
} from 'data/dataService';
import { setScope } from 'data/cache';

const ok = (body) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
});
const fail = (status) => ({
    ok: false,
    status,
    json: () => Promise.resolve({})
});

// Lets chained promise callbacks run without advancing fake timers
const settle = () => jest.advanceTimersByTimeAsync(0);

describe('dataService caching', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        setScope('org:user');
        clearCache();
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            configurable: true
        });
    });
    afterEach(() => {
        jest.useRealTimers();
        delete global.fetch;
    });

    describe('bundle list TTL and stale-while-revalidate', () => {
        it('serves a fresh list from cache without refetching', async () => {
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [1] })));

            await getLightningComponentBundles('lwcComps');
            jest.advanceTimersByTime(TTL_MS - 1000);
            const second = await getLightningComponentBundles('lwcComps');

            expect(second).toEqual({ data: [1] });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('keys the cache by component type', async () => {
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [] })));

            await getLightningComponentBundles('lwcComps');
            await getLightningComponentBundles('auraComps');

            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('returns stale data at once and revalidates in the background', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce(ok({ data: ['old'] }))
                .mockResolvedValueOnce(ok({ data: ['new'] }));
            await getLightningComponentBundles('lwcComps');
            jest.advanceTimersByTime(TTL_MS + 1);
            const onRevalidate = jest.fn();

            const stale = await getLightningComponentBundles('lwcComps', {
                onRevalidate
            });

            expect(stale).toEqual({ data: ['old'] });
            await settle();
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(onRevalidate).toHaveBeenCalledWith({ data: ['new'] });
            // the next read is fresh again
            expect(await getLightningComponentBundles('lwcComps')).toEqual({
                data: ['new']
            });
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('keeps the stale entry when background revalidation fails', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce(ok({ data: ['old'] }))
                .mockResolvedValue(fail(404));
            await getLightningComponentBundles('lwcComps');
            jest.advanceTimersByTime(TTL_MS + 1);
            const onRevalidateError = jest.fn();

            await getLightningComponentBundles('lwcComps', {
                onRevalidateError
            });
            await settle();

            expect(onRevalidateError).toHaveBeenCalledWith(
                expect.objectContaining({ status: 404 })
            );
            expect(getBundlesUpdatedAt('lwcComps')).not.toBeNull();
        });

        it('does not touch the network when offline with cached data', async () => {
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [1] })));
            await getLightningComponentBundles('lwcComps');
            jest.advanceTimersByTime(TTL_MS + 1);
            Object.defineProperty(navigator, 'onLine', { value: false });

            const result = await getLightningComponentBundles('lwcComps');

            expect(result).toEqual({ data: [1] });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('reports when the list was last fetched', async () => {
            expect(getBundlesUpdatedAt('lwcComps')).toBeNull();
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [] })));
            const before = Date.now();

            await getLightningComponentBundles('lwcComps');

            expect(getBundlesUpdatedAt('lwcComps')).toBe(before);
        });

        it('hands out copies so callers can mutate results', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve(ok({ data: [{ expanded: false }] }))
            );
            const first = await getLightningComponentBundles('lwcComps');
            first.data[0].expanded = true;

            const second = await getLightningComponentBundles('lwcComps');

            expect(second.data[0].expanded).toBe(false);
        });
    });

    describe('per-bundle items', () => {
        it('caches each bundle by id', async () => {
            global.fetch = jest.fn((url) =>
                Promise.resolve(ok({ data: [url] }))
            );

            const a1 = await getLightningComponentBundleById('a');
            await getLightningComponentBundleById('b');
            const a2 = await getLightningComponentBundleById('a');

            expect(a2).toEqual(a1);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('refetches an expired bundle (no SWR for items)', async () => {
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [] })));
            await getLightningComponentBundleById('a');
            jest.advanceTimersByTime(TTL_MS + 1);

            await getLightningComponentBundleById('a');

            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('force bypasses the cache', async () => {
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [] })));
            await getLightningComponentBundleById('a');

            await getLightningComponentBundleById('a', { force: true });

            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('in-flight de-duplication', () => {
        it('shares one request between concurrent identical calls', async () => {
            let resolve;
            global.fetch = jest.fn(
                () =>
                    new Promise((r) => {
                        resolve = r;
                    })
            );

            const p1 = getLightningComponentBundles('lwcComps');
            const p2 = getLightningComponentBundles('lwcComps');
            await settle();
            resolve(ok({ data: [1] }));

            expect(await p1).toEqual({ data: [1] });
            expect(await p2).toEqual({ data: [1] });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('allows a new request once the first has settled with an error', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce(fail(404))
                .mockResolvedValueOnce(ok({ data: [2] }));

            await expect(
                getLightningComponentBundles('lwcComps')
            ).rejects.toMatchObject({ status: 404 });
            const result = await getLightningComponentBundles('lwcComps');

            expect(result).toEqual({ data: [2] });
        });

        it('does not cache failures', async () => {
            global.fetch = jest.fn(() => Promise.resolve(fail(403)));

            await expect(
                getLightningComponentBundleById('a')
            ).rejects.toBeDefined();

            expect(getBundlesUpdatedAt('lwcComps')).toBeNull();
            await expect(
                getLightningComponentBundleById('a')
            ).rejects.toBeDefined();
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('search abort and ordering', () => {
        const deferredFetch = () => {
            const calls = [];
            global.fetch = jest.fn((url, options) => {
                return new Promise((resolve, reject) => {
                    const call = { url, options, resolve, reject };
                    options?.signal?.addEventListener('abort', () => {
                        const error = new Error('aborted');
                        error.name = 'AbortError';
                        reject(error);
                    });
                    calls.push(call);
                });
            });
            return calls;
        };

        it('aborts the superseded request and rejects it with AbortError', async () => {
            const calls = deferredFetch();

            const first = searchLightningComponentBundle('lwcComps', 'ab');
            const firstResult = first.catch((e) => e);
            await settle();
            const second = searchLightningComponentBundle('lwcComps', 'abc');
            await settle();

            expect(calls[0].options.signal.aborted).toBe(true);
            expect(calls[1].options.signal.aborted).toBe(false);
            calls[1].resolve(ok({ data: ['abc'] }));
            expect(await second).toEqual({ data: ['abc'] });
            expect(isAbortError(await firstResult)).toBe(true);
        });

        it('a stale response can never overwrite a newer one, even if fetch ignores abort', async () => {
            const calls = [];
            global.fetch = jest.fn(
                () =>
                    new Promise((resolve) => {
                        calls.push(resolve); // never rejects on abort
                    })
            );

            const first = searchLightningComponentBundle('lwcComps', 'a');
            const firstResult = first.then(
                (v) => v,
                (e) => e
            );
            await settle();
            const second = searchLightningComponentBundle('lwcComps', 'ab');
            await settle();
            calls[1](ok({ data: ['new'] }));
            calls[0](ok({ data: ['stale'] })); // arrives late

            expect(await second).toEqual({ data: ['new'] });
            expect(isAbortError(await firstResult)).toBe(true);
        });

        it('joins an identical search that is already running', async () => {
            const calls = deferredFetch();

            const p1 = searchLightningComponentBundle('lwcComps', 'x');
            const p2 = searchLightningComponentBundle('lwcComps', 'x');
            await settle();
            calls[0].resolve(ok({ data: [1] }));

            expect(await p1).toEqual({ data: [1] });
            expect(await p2).toEqual({ data: [1] });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('caches finished searches', async () => {
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [1] })));

            await searchLightningComponentBundle('lwcComps', 'x');
            await searchLightningComponentBundle('lwcComps', 'x');

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('aborts a search that is waiting to retry', async () => {
            global.fetch = jest.fn(() => Promise.resolve(fail(503)));

            const first = searchLightningComponentBundle('lwcComps', 'a');
            const firstResult = first.catch((e) => e);
            await settle(); // first attempt failed, now backing off
            searchLightningComponentBundle('lwcComps', 'b').catch(() => {});
            await settle();

            expect(isAbortError(await firstResult)).toBe(true);
        });
    });

    describe('retry with exponential backoff', () => {
        it('retries 5xx with doubling delays then succeeds', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce(fail(503))
                .mockResolvedValueOnce(fail(500))
                .mockResolvedValueOnce(ok({ data: ['ok'] }));

            const promise = getLightningComponentBundles('lwcComps');
            await settle();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(BASE_DELAY_MS - 1);
            expect(global.fetch).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            expect(global.fetch).toHaveBeenCalledTimes(2);

            await jest.advanceTimersByTimeAsync(BASE_DELAY_MS * 2 - 1);
            expect(global.fetch).toHaveBeenCalledTimes(2);
            await jest.advanceTimersByTimeAsync(1);

            expect(await promise).toEqual({ data: ['ok'] });
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('retries 429 and network errors', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce(fail(429))
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce(ok({ data: [] }));

            const promise = getLightningComponentBundles('lwcComps');
            await jest.advanceTimersByTimeAsync(BASE_DELAY_MS * 3);

            await expect(promise).resolves.toEqual({ data: [] });
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('gives up after the maximum attempts and surfaces the status', async () => {
            global.fetch = jest.fn(() => Promise.resolve(fail(502)));

            const promise = getLightningComponentBundles('lwcComps');
            const result = promise.catch((e) => e);
            await jest.advanceTimersByTimeAsync(BASE_DELAY_MS * 10);

            expect(await result).toMatchObject({ status: 502 });
            expect(global.fetch).toHaveBeenCalledTimes(MAX_ATTEMPTS);
        });

        it.each([400, 401, 403, 404])('does not retry %i', async (status) => {
            global.fetch = jest.fn(() => Promise.resolve(fail(status)));

            await expect(
                getLightningComponentBundles('lwcComps')
            ).rejects.toMatchObject({ status });

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('refresh', () => {
        it('force (default) bypasses and replaces cached data', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce(ok({ data: ['old'] }))
                .mockResolvedValueOnce(ok({ data: ['new'] }));
            await getLightningComponentBundles('lwcComps');

            const result = await refresh('lwcComps');

            expect(result).toEqual({ data: ['new'] });
            expect(await getLightningComponentBundles('lwcComps')).toEqual({
                data: ['new']
            });
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('also drops cached bundle items', async () => {
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [] })));
            await getLightningComponentBundleById('a');

            await refresh('lwcComps');
            await getLightningComponentBundleById('a');

            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('refresh(type, false) respects the cache', async () => {
            global.fetch = jest.fn(() => Promise.resolve(ok({ data: [1] })));
            await getLightningComponentBundles('lwcComps');

            await refresh('lwcComps', false);

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('identity scoping', () => {
        it('does not serve one login the data of another', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce(ok({ data: ['orgA'] }))
                .mockResolvedValueOnce(ok({ data: ['orgB'] }));
            await getLightningComponentBundles('lwcComps');

            setScope('other-org:other-user');
            const result = await getLightningComponentBundles('lwcComps');

            expect(result).toEqual({ data: ['orgB'] });
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });
});
