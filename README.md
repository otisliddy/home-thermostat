# Overview

This project is for controlling home heating. The oil heating and immersion are controlled with relays connected to
Arduinos.
The Arduino code is under ./arduino.

AWS IoT controls the Arduino via MQTT. AWS Lambda functions interact with AWS IoT, and AWS StepFunctions
orchestrate turning the heating on/off in the future. DynamoDB is used to persist

1) times the heating was turned on and off
2) scheduled changes to the heating
3) temperature of DHW

Not all AWS resources are provisioned using AWS Amplify under ./amplify, most notably AWS IoT was added manually.

The front end is a React app under ./src.

# Getting Started

```
nvm use
npm install
npx ampx generate outputs --app-id d36tefta7j8ppr --branch master
npm start
```

`amplify_outputs.json` is gitignored and holds the backend resource names the app reads at build time,
so it must exist before `npm start` or `npm run build`. Generate it from the deployed branch as above,
or let `npx ampx sandbox` write it to point the app at your own sandbox stack instead. In Amplify
Hosting the backend build phase writes it before the frontend phase runs.

# Home Thermostat Common

The lambdas depend on it as an ordinary npm dependency (`home-thermostat-common: file:./home-thermostat-common`), so a
change to its src reaches them with no copy step. Amplify Gen 2 bundles each lambda with esbuild, which follows that
link and inlines only the modules the handler actually reaches.

Under Gen 1 this was not possible and a build.sh copied the library into each lambda directory. Those vendored copies
and the script are gone; if you see a `require('./home-thermostat-common')` anywhere it is a leftover and should be the
bare package name.

Its test tooling lives in the root package.json, because npm does not apply the root's dependency overrides to a
file:-linked package's own dependencies.

# Amplify

```
amplify pull --appId d36tefta7j8ppr --envName dev
```

The lambdas run on the nodejs22.x runtime, matching the Node version in .nvmrc.

# React

The front end is built with [Vite](https://vite.dev). A few things follow from that:

- ./index.html at the project root is the entry point, and it loads /src/index.jsx.
- Files containing JSX use the .jsx extension. Vite does not parse JSX out of a .js file.
- Static assets in ./public are served from the root, so ./public/favicon.ico is /favicon.ico.
- The Vite and ESLint configs are vite.config.mjs and eslint.config.mjs. They are .mjs rather than .js because the
  package itself is CommonJS.

Everything runs under [Vitest](https://vitest.dev), from one `npm test`. Tests sit next to the code they cover:
`src/**/*.test.js(x)` for the front end, `amplify/function/*/index.test.js` for the lambda handlers and
home-thermostat-common/test for the shared library.

The lambda handlers are CommonJS and construct their AWS clients at module load, so `vi.mock` cannot reach them --- it
rewrites ESM imports, not `require`. The suites spy on the client prototypes instead (`vi.spyOn(DynamoDBClient.prototype,
'send')`), which both module systems share. The shared-library suite still uses chai assertions; Vitest runs it as is.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in development mode on [http://localhost:3000](http://localhost:3000) and opens a browser, with hot
module replacement. `npm run dev` does the same thing.

### `npm test`

Runs every suite once.

### `npm run build`

Builds the app for production into ./build, which is the DistributionDir Amplify deploys.

### `npm run preview`

Serves the contents of ./build locally, to check a production build before deploying it.

### `npm run lint`

Runs ESLint over the front end and home-thermostat-common.
