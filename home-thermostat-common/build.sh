nvm use
npm config set registry https://registry.npmjs.org/

rm -rf node_modules package-lock.json
npm install --production

rm -rf ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common/*
rm -rf ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common/*
rm -rf ../amplify/backend/function/homethermostatCancelRunningWorkflow/src/home-thermostat-common/*
rm -rf ../amplify/backend/function/homethermostatProcessTemperatureStream/src/home-thermostat-common/*

cp -R * ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common/
cp -R * ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common/
cp -R * ../amplify/backend/function/homethermostatCancelRunningWorkflow/src/home-thermostat-common/
cp -R * ../amplify/backend/function/homethermostatProcessTemperatureStream/src/home-thermostat-common/

npm install
