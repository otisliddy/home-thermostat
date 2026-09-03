# Overview

This project is for controlling home heating. The oil heating and immersion are controlled with relays connected to
Arduinos.
The Arduino code is under ./arduino.

AWS IoT controls the Arduino via MQTT. AWS Lambda functions interact with AWS IoT, and AWS StepFunctions
orchestrate turning the heating on/off in the future. DynamoDB is used to persist

1) times the heating was turned on and off
2) scheduled changes to the heating
3) temperature of DHW

AWS IoT is defined under ./amplify/custom/iot. The things, device policy and temperature topic
rule the hardware currently uses were made by hand in the console and are still the live ones; the
stack creates its own branch-suffixed copies alongside them. See "IoT cutover" below.

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

# IoT cutover

`amplify/custom/iot/resource.ts` defines the things, the device IoT policy and the DHW temperature
topic rule, named per branch (`ht-main-master`, `ht-main-sandbox`, ...). Nothing in it touches the
unsuffixed things the ESP8266s are connected to, so deploying it cannot interrupt heating.

Which things the app and lambdas address is a separate switch:
`DEVICES_REFLASHED_ONTO_BRANCH_THINGS` in `amplify/backend.ts`. While it is false, master keeps
addressing `ht-main` and `ht-immersion`, and every other branch addresses its own things - which is
what makes a sandbox safe to test against, since its things have no hardware behind them.

There are two boards but three things. `thermostatAwsIot` drives both relays from one ESP8266 -
oil on D2, immersion on D5 - over a single MQTT connection, and `tempSensor` is the second board.
Both currently share one certificate (`e6da39c342...`), which is attached to `ht-main` only and
carries `HtMainPolicy` (`iot:*` on `*`); that breadth is what makes the shared certificate work
today.

`ht-device-policy-<branch>` is scoped to `ht-*-<branch>` shadows rather than to the connecting
thing, because a per-thing policy would lock the thermostat board out of one of its two relays.

To cut over:

1. Mint a certificate and attach it to the new things and `ht-device-policy-master`. One
   certificate per board is enough; attach the thermostat's to both `ht-main-master` and
   `ht-immersion-master`:
   `aws iot create-keys-and-certificate --set-as-active --certificate-pem-outfile ... --profile personal`
2. Put it in the sketch's `certs.h`, change the topic constants to the suffixed thing names, and
   flash both boards.
3. Set `DEVICES_REFLASHED_ONTO_BRANCH_THINGS` to true in `amplify/backend.ts` and deploy.
4. Delete the old things, the shared certificate, `HtMainPolicy` and `DwhTempToDynamoDB`.

Nothing else requires a reflash. The sketches are untouched by the move to Gen 2 and work against
the current backend as they are.

# Live updates in the browser

The front end subscribes to `$aws/things/<thing>/shadow/name/<thing>_shadow/update/accepted` over
MQTT/WebSocket, so a run ending or the hardware being switched shows up without a reload.

Two separate grants are needed and the second is easy to miss:

1. IAM, on the identity pool's authenticated role (`Cognito_homethermostattempAuth_Role`, inline
   policy `SubscribeToShadowUpdates`): `iot:Connect`, `iot:Subscribe`, `iot:Receive`.
2. An **IoT** policy attached to the Cognito identity itself (`HtFrontendPolicy`), granting the
   same actions. With Cognito credentials the IAM role governs the REST shadow calls, but the
   broker checks the attached IoT policy for MQTT. Without it the socket connects and is then
   dropped, surfacing only as `ConnectionDisrupted`.

`HtFrontendPolicy` is attached per identity, so a newly approved user has no MQTT access until it
is attached to theirs (`aws iot attach-policy --policy-name HtFrontendPolicy --target <identityId>`).
The authenticated role already carries `iot:AttachPolicy` for doing this from the app.

# Integration tests

`npm run test:integration` drives a deployed stack end to end: it turns the heating on through the
lambda, pushes a synthetic temperature reading and asserts the run closes itself with the right
reason. It reads `amplify_outputs.json` to find the stack, so point it at a sandbox first:

```
AWS_PROFILE=personal npx ampx sandbox --once
AWS_PROFILE=personal npm run test:integration
```

The suite refuses to run when the outputs name the live `ht-main`/`ht-immersion` things, because it
would otherwise switch the real boiler on and off.

These tests are what would have caught the two IAM policies the Gen 1 to Gen 2 migration dropped
(`iot:UpdateThingShadow` on changeState, `states:SendTaskSuccess` on the temperature stream); both
failed silently at runtime and nothing in the unit suites could see it.

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
