#!/bin/bash

# Check if -d flag is passed for dependency installation
INSTALL_DEPS=false
if [ "$1" = "-d" ]; then
  INSTALL_DEPS=true
fi

# List of Lambda functions to update
FUNCTIONS=(
  "homethermostatChangeState"
  "homethermostatStartScheduleStateChange"
  "homethermostatCancelRunningWorkflow"
  "homethermostatStoreTaskToken"
  "homethermostatProcessTemperatureStream"
)

if [ "$INSTALL_DEPS" = true ]; then
  echo "Installing dependencies..."
  nvm use 22
  npm config set registry https://registry.npmjs.org/

  rm -rf node_modules package-lock.json
  npm install --production
fi

# Copy src directory to all Lambda functions
echo "Copying src directory to Lambda functions..."
for FUNC in "${FUNCTIONS[@]}"; do
  DEST="../amplify/backend/function/$FUNC/src/home-thermostat-common"

  if [ "$INSTALL_DEPS" = true ]; then
    # Full clean and copy everything
    echo "  Cleaning and copying everything to $FUNC..."
    rm -rf "$DEST"/*
    cp -R * "$DEST"/
  else
    # Only copy src directory
    echo "  Copying src to $FUNC..."
    rm -rf "$DEST/src"
    mkdir -p "$DEST"
    cp -R src "$DEST"/
  fi
done

if [ "$INSTALL_DEPS" = true ]; then
  echo "Installing dev dependencies..."
  npm install
fi

echo "Build complete!"
