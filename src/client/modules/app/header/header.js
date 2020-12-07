import { LightningElement, api , track} from 'lwc';

export default class Header extends LightningElement {
    @api loggedInUser = {}  ;

    get getName(){
        return this.loggedInUser.display_name ; 
    }
    get isLoggedIn(){
        return (!! this.loggedInUser) ; 
    }
    get getUsername(){
        return this.loggedInUser.username  ; 
    }
}
