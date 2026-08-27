import { defineFunction } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
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
  // Gen 1 custom-policies.json, which the assessment flagged as needing to be re-added by hand.
  backend.homethermostatSignUp.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    })
  );
}
