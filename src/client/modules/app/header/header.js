import { LightningElement, api } from 'lwc';

export default class Header extends LightningElement {
    @api loggedInUser = {};

    isLoading = true;
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
