let GITHUB = 'https://github.com/londoner1234/lwc-inspector';
const LABELS = {
    HEADER: 'Lightning Web Component Inspector',
    TAGLINE:
        'View and download the source of Lightning components in any Salesforce org, without installing the Salesforce CLI.',
    LOGIN_PROD: 'Log in to Production',
    LOGIN_SANDBOX: 'Log in to Sandbox',
    LOGIN_SESSIONID: 'Use a session ID',
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
            HEADER: 'What is it?',
            PARAGRAPHS: [
                'Seen something odd on a Salesforce page and need to know what is going on under the hood? If it is a Lightning Web Component and you do not have the Salesforce CLI to hand, this tool is for you.'
            ],
            LIST: [
                'List the components in an org',
                'Search components by name',
                'Click a file to view its source',
                'Download a component straight to your machine'
            ]
        },
        {
            KEY: '2',
            HEADER: 'How does it work?',
            PARAGRAPHS: [
                'The app is built with LWC OSS and hosted on Vercel.',
                'Log in with OAuth, or use an existing session ID and My Domain URL (for example https://mydomain.my.salesforce.com).',
                'Your session is then used to read component source through the Salesforce Tooling API. Nothing about your org is stored by the app.',
                'The source code is available on GitHub.'
            ]
        }
    ],
    ABOUT_LINKS: [
        { HREF: 'https://lwc.dev/', TEXT: 'LWC OSS' },
        {
            HREF: 'https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_tasks.htm',
            TEXT: 'Tooling API'
        },
        { HREF: GITHUB, TEXT: 'Github' }
    ]
};
export { LABELS };
