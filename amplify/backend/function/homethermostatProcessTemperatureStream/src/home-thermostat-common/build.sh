nvm use
npm config set registry https://registry.npmjs.org/

# Copy source files (excluding node_modules) to Lambda functions
copy_to_function() {
  echo "Copying to $1"
  local target=$1
  rm -rf "$target"/*
  mkdir -p "$target"

  # Copy everything except node_modules
  find . -maxdepth 1 ! -name node_modules ! -name . ! -name .. -exec cp -R {} "$target"/ \;
}

copy_to_function "../amplify/backend/function/homethermostatChangeState/src/home-thermostat-common"
copy_to_function "../amplify/backend/function/homethermostatStartScheduleStateChange/src/home-thermostat-common"
copy_to_function "../amplify/backend/function/homethermostatCancelRunningWorkflow/src/home-thermostat-common"
copy_to_function "../amplify/backend/function/homethermostatProcessTemperatureStream/src/home-thermostat-common"

# Install dependencies for local development/testing
npm install
