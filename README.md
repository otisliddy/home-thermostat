# Overview

This project is for controlling home heating. The oil heating and immersion are controlled with relays connected to
Arduinos.
The Arduino code is under ./arduino.

AWS IoT controls the Arduino via MQTT. AWS Lambda functions interact with AWS IoT, and AWS StepFunctions
orchestrate turning the heating on/off in the future. DynamoDB is used to persist

1) times the heating was turned on and off
2) scheduled changes to the heating
3) temperature of DHW

Not AWS resources are provisioned using AWS Amplify under ./amplify, most notably AWS IoT was added manually.

The front end is a React app under ./src.

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

The front end is built with [Vite](https://vite.dev). Node 22 (see .nvmrc).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in development mode on [http://localhost:3000](http://localhost:3000), with hot module replacement.
`npm run dev` does the same thing.

### `npm test`

Runs the front end tests with [Vitest](https://vitest.dev) and the home-thermostat-common tests with
[Mocha](https://mochajs.org), once each.

### `npm run build`

Builds the app for production into ./build, which is the DistributionDir Amplify deploys.

### `npm run preview`

Serves the contents of ./build locally, to check a production build before deploying it.

### `npm run lint`

Runs ESLint over the front end and home-thermostat-common.
