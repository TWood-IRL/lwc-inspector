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