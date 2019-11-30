rm -rf ../amplify/backend/function/changeHeatingState/src/home-thermostat-common
mkdir -p ../amplify/backend/function/changeHeatingState/src/home-thermostat-common

cp -R src ../amplify/backend/function/changeHeatingState/src/home-thermostat-common/src
cp index.js ../amplify/backend/function/changeHeatingState/src/home-thermostat-common/index.js
cp -R node_modules ../amplify/backend/function/changeHeatingState/src/home-thermostat-common/node_modules
