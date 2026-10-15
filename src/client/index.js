// Must load before the engine so SLDS global styles apply (synthetic shadow DOM).
// Note - https://github.com/salesforce/lwc/issues/2029 - slots wont work correctly.
import '@lwc/synthetic-shadow';
import { createElement } from 'lwc';
//import MyApp from 'my/app';
import MainApp from 'my/main';
import Analytics from 'analytics';
import googleTagManager from '@analytics/google-tag-manager';

const app = createElement('my-main', { is: MainApp });
const analytics = Analytics({
    app: 'lwc-inspector',
    plugins: [
        googleTagManager({
            containerId: 'GTM-W4JMV84'
        })
    ]
});
analytics.page();

// eslint-disable-next-line @lwc/lwc/no-document-query
document.querySelector('#main').appendChild(app);
