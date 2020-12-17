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

export function getLightningComponentBundle(id) {
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
