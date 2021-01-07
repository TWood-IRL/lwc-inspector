export function getLightningComponentBundles(compTypeValue) {
    return new Promise((resolve, reject) => {
        fetch(`/api/LightningComponents?type=${compTypeValue}`)
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
export function searchLightningComponentBundle(compTypeValue, searchTerm) {
    // pass the Id, get the contents of the bundle
    return new Promise((resolve, reject) => {
        fetch(`/api/LightningComponents?type=${compTypeValue}&q=${searchTerm}`  )
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
