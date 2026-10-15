/**
 * Gets logged in user info
 * @returns {Promise<Object>} user info or an empty object if user is not logged in
 */
export async function getLoggedInUser() {
    const response = await fetch('/oauth2/whoami');
    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }
    return response.json();
}

export async function setSessionInformation({ sessionId, myDomainURL }) {
    const params = new URLSearchParams({ sessionId, myDomainURL });
    const response = await fetch(`/api/v1/sessionId?${params}`);
    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }
}
