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

Start simple by running `yarn watch` (or `npm run watch`, if you set up the project with `npm`). This will start the project with a local development server.

The source files are located in the [`src`](./src) folder. All web components are within the [`src/client/modules`](./src/modules) folder. The folder hierarchy also represents the naming structure of the web components. The entry file for the custom Express configuration can be found in the ['src/server'](./src/server) folder.

Find more information on the main repo on [GitHub](https://github.com/muenzpraeger/create-lwc-app).

# License

The code is available under the [MIT license](https://github.com/londoner1234/lwc-inspector/blob/main/LICENSE).
