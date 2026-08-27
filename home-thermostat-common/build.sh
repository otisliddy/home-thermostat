nvm use
npm config set registry https://registry.npmjs.org/

rm -rf node_modules package-lock.json
npm install --omit=dev

for dest in ../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common \
            ../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common; do
  rm -rf "$dest"/*
  # Only what the lambda runs. Copying the tests and the lock file as well would deploy them and
  # have the dev tooling they pull in scanned for vulnerabilities the lambda is never exposed to.
  cp -R index.js package.json src node_modules "$dest/"
done

npm install
