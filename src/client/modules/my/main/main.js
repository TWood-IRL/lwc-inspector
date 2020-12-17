import { LightningElement, track } from 'lwc';
import { getLoggedInUser, setSessionInformation } from 'data/authService';
import { getLightningComponentBundles } from 'data/dataService';

export default class Main extends LightningElement {
    @track loggedInUser = undefined;
    @track state;
    loading = true;
    displayInputs = false ; 
    lightningComponentBundles = []  ; 
    connectedCallback() {
        getLoggedInUser().then((response) => {
            if (response.user_id === undefined) {
                this.loggedInUser = undefined;
                this.state = 'login';
            } else {
                this.loggedInUser = response;
                this.state = 'list';
                this.getLightningComponents() ; 
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
        return this.loggedInUser.username;
    }

    getLightningComponents(){
        getLightningComponentBundles().then((resp)=> {
            this.lightningComponentBundles = resp.data ; 
        })
    }
    setDisplayInputs() {
        this.displayInputs = !this.displayInputs;
    }
   
    setSessionInfo(){
        //read inputs then post to server to cache it.
       /*  
       under construction 
       let elements = this.template.querySelectorAll('c-input') ; 
        let inputs = {
            "sessionId" : elements[0].getValue().value ,  
            "myDomainURL" : elements[1].getValue().value  
        } ; 
        elements.forEach((ele) => {
            inputs.push(ele.getValue().value) ; 
        })
            //first pos = sessionId, second pos = myDomainURL
        setSessionInformation(inputs).then((res) => {
            console.log(res)
            this.loading = false;
        });   */
    }

}
