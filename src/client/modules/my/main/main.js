import { LightningElement, track } from 'lwc';
import { getLoggedInUser, setSessionInformation } from 'data/authService';
import { LABELS } from 'data/labelService';

export default class Main extends LightningElement {
    @track loggedInUser = undefined;
    loading = true;
    displayInputs = false;
    LABEL = LABELS;
    lightningComponentBundles = [];
    connectedCallback() {
        getLoggedInUser().then((response) => {
            if (response.user_id === undefined) {
                this.loggedInUser = undefined;
            } else {
                this.loggedInUser = response;
            }
            this.loading = false;
        });
    }
    get isLoading() {
        return this.loading;
    }
    get isLoggedIn() {
        return this.loggedInUser;
    }

    get getName() {
        return this.loggedInUser.display_name;
    }
    get getIsLoggedIn() {
        return !!this.loggedInUser;
    }
    get getUsername() {
        return this.loggedInUser.username ? this.loggedInUser.username : '';
    }

    setDisplayInputs() {
        this.displayInputs = !this.displayInputs;
    }

    setSessionInfo() {
        let elements = this.template.querySelectorAll('lightning-input');
        let inputs = {
            sessionId: elements[0].value,
            myDomainURL: elements[1].value
        };

        setSessionInformation(inputs).then((res) => {
            console.log(res);
            this.loading = false;
            window.location.reload();
        });
    }
    toggleLoading(event) {
        event.stopPropagation();
        this.loading = event.detail.loading;
    }
}
