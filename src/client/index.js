import { createElement } from 'lwc';
//import MyApp from 'my/app';
import MainApp from 'my/main';
import '@lwc/synthetic-shadow'; //allow lightning design system

const app = createElement('my-app', { is: MainApp });
// eslint-disable-next-line @lwc/lwc/no-document-query
document.querySelector('#main').appendChild(app);
