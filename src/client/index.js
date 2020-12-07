import { createElement } from 'lwc';
//import MyApp from 'my/app';
import MainApp from 'app/main';

const app = createElement('my-app', { is: MainApp });
// eslint-disable-next-line @lwc/lwc/no-document-query
document.querySelector('#main').appendChild(app);
