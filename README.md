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

## How to start?

Requires Node 20 or newer.

1. `npm install`
2. Create a `.env` file with `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_CALLBACK_URL`, `LOGIN_URL_PROD`, `LOGIN_URL_SANDBOX` and `NODE_SESSION_SECRET_KEY`.
3. `npm run watch` rebuilds the client with Rollup and runs the API server on http://localhost:3002.

Other scripts: `npm run build` (production bundle into `dist`), `npm start`-style serving via `npm run serve`, `npm run test:unit`, `npm run lint`.

Web components live in [`src/client/modules`](./src/client/modules); the Express API is in [`src/server`](./src/server). The client is built with Rollup and `@lwc/rollup-plugin` (see `rollup.config.mjs`).

## Deploying to Vercel

1. Import the repo in Vercel. `vercel.json` already sets the install command, build command (`npm run build`) and output directory (`dist`).
2. Add these environment variables: `NODE_SESSION_SECRET_KEY`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_CALLBACK_URL` (`https://<your-domain>/auth/callback`), `LOGIN_URL_PROD`, `LOGIN_URL_SANDBOX`.
3. Set the same callback URL on your Salesforce Connected App.

The Express app is exported from `src/server/app.js` and served as a serverless function through `api/index.js`. Sessions live in a signed cookie, so no database or Redis is needed.

# License

The code is available under the [MIT license](https://github.com/londoner1234/lwc-inspector/blob/main/LICENSE).
