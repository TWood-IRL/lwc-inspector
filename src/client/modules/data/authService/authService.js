import { setScope, clear } from 'data/cache';

/**
 * Gets logged in user info
 * @returns {Promise<Object>} user info or an empty object if user is not logged in
 */
export async function getLoggedInUser() {
    const response = await fetch('/oauth2/whoami');
    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }
    const user = await response.json();
    // Key the data cache on org + user so another login never sees this data
    if (user?.user_id) {
        setScope(`${user.organization_id ?? ''}:${user.user_id}`);
    } else {
        setScope(null);
        clear(); // logged out: leave nothing behind in sessionStorage
    }
    return user;
}

export async function setSessionInformation({ sessionId, myDomainURL }) {
    const params = new URLSearchParams({ sessionId, myDomainURL });
    const response = await fetch(`/api/v1/sessionId?${params}`);
    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }
    setScope(null); // new session: drop anything cached for the old one
}
