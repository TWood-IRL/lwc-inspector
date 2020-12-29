export function getLightningComponentBundles() {
    return new Promise((resolve, reject) => {
        fetch('/api/LightningComponents')
            .then((response) => {
                if (!response.ok) {
                    reject(response);
                }
                return response.json();
            })
            .then((jsonResponse) => resolve(jsonResponse))
            .catch((error) => {
                reject(error);
            });
    });
}

export function getLightningComponentBundleById(id) {
    // pass the Id, get the contents of the bundle
    return new Promise((resolve, reject) => {
        fetch('/api/LightningComponent/' + id)
            .then((response) => {
                if (!response.ok) {
                    reject(response);
                }
                return response.json();
            })
            .then((jsonResponse) => resolve(jsonResponse))
            .catch((error) => {
                reject(error);
            });
    });
}
export function searchLightningComponentBundle(searchTerm) {
    // pass the Id, get the contents of the bundle
    return new Promise((resolve, reject) => {
        fetch('/api/LightningComponents?q=' + searchTerm)
            .then((response) => {
                if (!response.ok) {
                    reject(response);
                }
                return response.json();
            })
            .then((jsonResponse) => resolve(jsonResponse))
            .catch((error) => {
                reject(error);
            });
    });
}

export function downloadLightningComponent(componentName) {
    // pass the Id, get the contents of the bundle
    return new Promise((resolve, reject) => {
        fetch('/api/DownloadLightningComponents?q=' + componentName)
            .then((response) => {
                if (!response.ok) {
                    reject(response);
                }
                return response.json();
            })
            .then((jsonResponse) => resolve(jsonResponse))
            .catch((error) => {
                reject(error);
            });
    });
}
