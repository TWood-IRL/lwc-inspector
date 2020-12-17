import { LightningElement, track } from 'lwc';
import { getLoggedInUser } from 'data/authService';

export default class Main extends LightningElement {
    @track loggedInUser = undefined;
    @track state;
    isLoading = true;

    connectedCallback() {
        getLoggedInUser().then((response) => {
            if (response.user_id === undefined) {
                this.loggedInUser = undefined;
                this.state = 'login';
            } else {
                this.loggedInUser = response;
                this.state = 'list';
            }
        });
    }
    get isLoggedIn() {
        return this.loggedInUser ;  
    }

    get getName() {
        return this.loggedInUser.display_name;
    }
    get isLoggedIn() {
        this.isLoading = false;
        return !!this.loggedInUser;
    }
    get getUsername() {
        return this.loggedInUser.username;
    }
    
}
