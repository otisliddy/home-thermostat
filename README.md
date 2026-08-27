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
npm start
```

# Home Thermostat Common

After making changes to home-thermostat-common src, ./home-thermostat-common/build.sh must be run to copy the files to
the lambdas that depend on them. It installs the runtime dependencies and copies index.js, package.json, src and
node_modules; the tests and the lock file are deliberately not deployed.

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

Front end tests sit next to the code they cover as `src/**/*.test.js(x)` and run under
[Vitest](https://vitest.dev). The home-thermostat-common tests are in home-thermostat-common/test and run under
[Mocha](https://mochajs.org).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in development mode on [http://localhost:3000](http://localhost:3000) and opens a browser, with hot
module replacement. `npm run dev` does the same thing.

### `npm test`

Runs the Vitest and Mocha suites, once each.

### `npm run build`

Builds the app for production into ./build, which is the DistributionDir Amplify deploys.

### `npm run preview`

Serves the contents of ./build locally, to check a production build before deploying it.

### `npm run lint`

Runs ESLint over the front end and home-thermostat-common.
