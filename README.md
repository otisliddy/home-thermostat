# Overview
This project is for controlling home heating. The oil heating and immersion are controlled with relays connected to Arduinos.
The Arduino code is under ./arduino. 

AWS IoT controls the Arduino via MQTT. AWS Lambda functions interact with AWS IoT, and AWS StepFunctions
orchestrate turning the heating on/off in the future. DynamoDB is used to persist 
1) the current state of the heating (on/off, temperature etc) and
2) the future scheduled changes to the heating.
Mot AWS resources are provisioned using AWS Amplify under ./amplify.

The front end is a React app under ./src.

# Home Thermostat Common
After making any changes to home-thermostat-common, ./home-thermostat-common/build.sh must be run to copy the files to 
dependent projects.
```

# Amplify
amplify pull --appId d36tefta7j8ppr --envName dev
# React

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.
