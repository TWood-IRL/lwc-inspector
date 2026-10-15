# lwc-inspector

LWC app to view lwc components in a given org.

Have you ever gone to look at a salesforce org, seen something funny happen on the page and need to see whats going on under the hood ?
Oh It's a Lightning Web Component is it?
You don't have sfdx installed?
Ah so this is the tool thats meant to help you in that situation.
I encounted this quite often and thought why not make an app for it, if your reading this then hope it helps

Current features include:
-Listing Components in a org
-Searching existing components (by name only)
-Click to view the component source
-Download the source directly to your machine

# Live site.

Production
https://lwc-inspector.herokuapp.com/

Staging
https://lwc-inspector-staging.herokuapp.com/

## How to start?

Requires Node 20 or newer.

1. `npm install`
2. Create a `.env` file with `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_CALLBACK_URL`, `LOGIN_URL_PROD`, `LOGIN_URL_SANDBOX` and `NODE_SESSION_SECRET_KEY`.
3. `npm run watch` rebuilds the client with Rollup and runs the API server on http://localhost:3002.

Other scripts: `npm run build` (production bundle into `dist`), `npm start`-style serving via `npm run serve`, `npm run test:unit`, `npm run lint`.

Web components live in [`src/client/modules`](./src/client/modules); the Express API is in [`src/server`](./src/server). The client is built with Rollup and `@lwc/rollup-plugin` (see `rollup.config.mjs`).

# License

The code is available under the [MIT license](https://github.com/londoner1234/lwc-inspector/blob/main/LICENSE).
