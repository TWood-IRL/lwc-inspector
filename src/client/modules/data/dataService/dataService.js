async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const error = new Error(`Request failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

export function getLightningComponentBundles(compTypeValue) {
    return getJson(
        `/api/LightningComponents?type=${encodeURIComponent(compTypeValue)}`
    );
}

// pass the Id, get the contents of the bundle
export function getLightningComponentBundleById(id) {
    return getJson(`/api/LightningComponent/${encodeURIComponent(id)}`);
}

export function searchLightningComponentBundle(compTypeValue, searchTerm) {
    const params = new URLSearchParams({ type: compTypeValue, q: searchTerm });
    return getJson(`/api/LightningComponents?${params}`);
}
