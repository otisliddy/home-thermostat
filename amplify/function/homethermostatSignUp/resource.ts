import { defineFunction } from '@aws-amplify/backend';
import type { Backend } from '../../backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

export const homethermostatSignUp = defineFunction({
  entry: './index.js',
  name: `homethermostatSignUp-${branchName}`,
  timeoutSeconds: 25,
  memoryMB: 128,
  environment: { ENV: `${branchName}`, REGION: 'eu-west-1' },
  runtime: 22,
});

export function applyEscapeHatches(backend: Backend) {
  backend.homethermostatSignUp.resources.cfnResources.cfnFunction.functionName = `homethermostatSignUp-${branchName}`;
}
