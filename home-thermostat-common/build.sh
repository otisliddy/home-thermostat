source ~/.nvm/nvm.sh
nvm use

rm -rf node_modules
npm install --production

rm -rf ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common
rm -rf ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common
#rm -rf ../amplify/backend/function/cancelRunningWorkflows/src/home-thermostat-common
mkdir -p ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common
mkdir -p ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common
#mkdir -p ../amplify/backend/function/cancelRunningWorkflows/src/home-thermostat-common

cp -R src ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common/src
cp -R src ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common/src
#cp -R src ../amplify/backend/function/cancelRunningWorkflows/src/home-thermostat-common/src
cp index.js ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common/index.js
cp index.js ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common/index.js
#cp index.js ../amplify/backend/function/cancelRunningWorkflows/src/home-thermostat-common/index.js
cp -R node_modules ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common/node_modules
cp -R node_modules ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common/node_modules
#cp -R node_modules ../amplify/backend/function/cancelRunningWorkflows/src/home-thermostat-common/node_modules

npm install
