/**
 * Gets logged in user info
 * @returns {Promise} Promise holding user info or an empty object if user is not logged in
 */
export function getLoggedInUser() {
    return new Promise((resolve, reject) => {
        fetch('/oauth2/whoami')
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
 export function setSessionInformation(inputs) { ///api/v1/sessionId
    return new Promise((resolve, reject) => {
        fetch(`/api/v1/sessionId?sessionId=${inputs.sessionId}&myDomainURL=${inputs.myDomainURL}`)
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