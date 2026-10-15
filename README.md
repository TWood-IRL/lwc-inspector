# lwc-inspector

A web app for browsing the Lightning Web Components deployed in a Salesforce org, with no Salesforce CLI (`sfdx`/`sf`) or local project needed.

## What it does

Log in with your Salesforce credentials (production or sandbox) through OAuth, and lwc-inspector connects to the org and lets you:

- List every Lightning Web Component in the org
- Search components by name
- Click a component to view its source files (HTML, JavaScript, CSS and metadata)
- Download a component's source straight to your machine as a zip

It is handy when something odd shows up on a page in an org and you want to see what the component is doing, but you are on a machine without the CLI installed.

## How it works

- **Client:** Lightning Web Components styled with the Salesforce Lightning Design System (SLDS), bundled with Rollup.
- **Server:** an Express app that handles the OAuth login and uses [jsforce](https://jsforce.github.io/) to read component metadata from the org. Sessions are kept in a signed cookie.
- **Hosting:** runs locally with Node, or on Vercel as a serverless function.

## How to start?

Requires Node 20 or newer.

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_CALLBACK_URL`, `LOGIN_URL_PROD`, `LOGIN_URL_SANDBOX` and `NODE_SESSION_SECRET_KEY`.
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
