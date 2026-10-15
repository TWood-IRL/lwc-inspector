import {
    getLightningComponentBundles,
    getLightningComponentBundleById,
    searchLightningComponentBundle,
    clearCache
} from 'data/dataService';

const mockFetch = (ok, body = { data: [] }, status = 200) => {
    global.fetch = jest.fn(() =>
        Promise.resolve({ ok, status, json: () => Promise.resolve(body) })
    );
};

describe('dataService', () => {
    beforeEach(() => clearCache());
    afterEach(() => {
        delete global.fetch;
    });

    it('requests bundles by type and returns the parsed body', async () => {
        mockFetch(true, { data: [{ id: '1' }] });

        const result = await getLightningComponentBundles('auraComps');

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/LightningComponents?type=auraComps'
        );
        expect(result).toEqual({ data: [{ id: '1' }] });
    });

    it('url-encodes the search term', async () => {
        mockFetch(true);

        await searchLightningComponentBundle('lwcComps', "o'brien & co");

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/LightningComponents?type=lwcComps&q=o%27brien+%26+co',
            expect.any(Object)
        );
    });

    it('url-encodes the bundle id', async () => {
        mockFetch(true);

        await getLightningComponentBundleById('0Rb/1 2');

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/LightningComponent/0Rb%2F1%202'
        );
    });

    it('rejects with the http status when the request fails', async () => {
        mockFetch(false, {}, 401);

        await expect(
            getLightningComponentBundles('lwcComps')
        ).rejects.toMatchObject({ status: 401 });
    });
});
