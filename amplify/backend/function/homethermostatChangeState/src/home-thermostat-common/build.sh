source ~/.nvm/nvm.sh
nvm use

rm -rf node_modules package-lock.json
npm install --production

rm -rf ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common
rm -rf ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common
rm -rf ../amplify/backend/function/homethermostatCancelRunningWorkflow/src/home-thermostat-common
mkdir -p ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common
mkdir -p ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common
mkdir -p ../amplify/backend/function/homethermostatCancelRunningWorkflow/src/home-thermostat-common

cp -R * ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common/
cp -R * ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common/
cp -R * ../amplify/backend/function/homethermostatCancelRunningWorkflow/src/home-thermostat-common/

npm install
