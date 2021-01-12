let GITHUB = 'https://github.com/londoner1234/lwc-inspector';
const LABELS = {
    HEADER: 'Lightning Web Component Inspector',
    LOGIN_PROD: ' Log In Production',
    LOGIN_SANDBOX: ' Log In Sandbox',
    LOGIN_SESSIONID: 'Use SessionId',
    ENTER_SESSION: 'Enter SessionId String',
    ENTER_MY_DOMAIN: 'Enter MyDomainURL',
    SET_SESSION: 'Set Session Information',
    LOGGED_IN_AS: 'Currently Logged in as:',
    WELCOME_HELLO: 'Hello ',
    PLACEHOLDER_SESSION: '12345678..',
    PLACEHOLDER_MYDOMAIN: 'https://mydomain.salesforce.com/',
    FOOTER_NOTE: '',
    GITHUB_FEEDBACK: GITHUB,
    GITHUB_URL: GITHUB,
    LOADING_SPINNER: 'Loading...',
    TOAST_CLOSE_TEXT: 'Close',
    SEARCH_HELPTEXT: 'Helptext',
    LWC_COMPONENT: 'LWC Components',
    AURA_COMPONENT: 'AURA Components',
    ABOUT_REF: 'References',
    ABOUT_HEADERS: [
        {
            KEY: '1',
            HEADER: 'What is It?',
            BODY: `Have you ever gone to look at a salesforce org, seen something funny happen on the page and need to see whats going on under the hood ? 
            Oh It's a Lightning Web Component is it? 
            You don't have sfdx installed? 
            Ah so this is the tool thats meant to help you in that situation. 
            I encountered this quite often and thought, "why not make an app for it"  if your reading this then hope it helps 

            Current features include: 
             -Listing Components in a org
             -Searching existing components (by name only)
             -Click to view the component source
             -Download the source directly to your machine`
        },
        {
            KEY: '2',
            HEADER: `How Does it work?`,
            BODY: `
            The App is built using LWC OSS, and hosted on heroku
            Login is performed through either Oauth or utilizing your existing sessionId + mydomain (eg.https://mydomain.my.salesforce.com)
            Once this information is provided your current session information is used to authenticate requests using the existing salesforce tooling api. 
            These requests then are returned and manipulated to display on screen correctly.
            Information pertaining your salesforce organization is not stored within the app
            Feel free to checkout the source code included in the footer`
        }
    ],
    ABOUT_LINKS: [
        { HREF: 'https://lwc.dev/', TEXT: 'LWC OSS' },
        {
            HREF:
                'https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_tasks.htm',
            TEXT: 'Tooling API'
        },
        { HREF: GITHUB, TEXT: 'Github' }
    ]
};
export { LABELS };
