import { LightningElement } from 'lwc';
import { getLoggedInUser, setSessionInformation } from 'data/authService';
import { LABELS } from 'data/labelService';

export default class Main extends LightningElement {
    loggedInUser = undefined;
    loading = true;
    displayInputs = false;
    LABEL = LABELS;

    async connectedCallback() {
        try {
            const response = await getLoggedInUser();
            this.loggedInUser =
                response.user_id === undefined ? undefined : response;
        } catch (error) {
            console.error('Unable to determine logged in user', error);
            this.loggedInUser = undefined;
        } finally {
            this.loading = false;
        }
    }

    get isLoading() {
        return this.loading;
    }
    get showGreeting() {
        return !this.loading;
    }
    get isLoggedIn() {
        return !!this.loggedInUser;
    }
    get getName() {
        return this.loggedInUser?.display_name;
    }
    get getUsername() {
        return this.loggedInUser?.username ?? '';
    }

    setDisplayInputs() {
        this.displayInputs = !this.displayInputs;
    }

    async setSessionInfo() {
        const sessionId = this.template.querySelector(
            '[data-id="sessionId"]'
        ).value;
        const myDomainURL = this.template.querySelector(
            '[data-id="myDomainURL"]'
        ).value;

        try {
            await setSessionInformation({ sessionId, myDomainURL });
            window.location.reload();
        } catch (error) {
            console.error('Unable to set session information', error);
        }
    }

    toggleLoading(event) {
        event.stopPropagation();
        this.loading = event.detail.loading;
    }
}
