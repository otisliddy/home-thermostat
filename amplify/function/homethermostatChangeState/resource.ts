import { defineFunction } from '@aws-amplify/backend';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Arn, Stack } from 'aws-cdk-lib';
import type { Backend } from '../../backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

export const homethermostatChangeState = defineFunction({
  entry: './index.js',
  name: `homethermostatChangeState-${branchName}`,
  timeoutSeconds: 25,
  memoryMB: 128,
  environment: { ENV: `${branchName}`, REGION: 'eu-west-1' },
  runtime: 22,
});

export function applyEscapeHatches(
  backend: Backend,
  homethermostatdevicestate: Table
) {
  backend.homethermostatChangeState.resources.cfnResources.cfnFunction.functionName = `homethermostatChangeState-${branchName}`;
  backend.homethermostatChangeState.addEnvironment(
    'STORAGE_HOMETHERMOSTATDEVICESTATE_STREAMARN',
    homethermostatdevicestate.tableStreamArn!
  );
  backend.homethermostatChangeState.addEnvironment(
    'STORAGE_HOMETHERMOSTATDEVICESTATE_ARN',
    homethermostatdevicestate.tableArn
  );
  backend.homethermostatChangeState.addEnvironment(
    'STORAGE_HOMETHERMOSTATDEVICESTATE_NAME',
    homethermostatdevicestate.tableName
  );
  // Dropped by the Gen 1 to Gen 2 migration, which does not carry hand-added role policies over.
  // Without it every state change fails with a 403 from IoT and the relay never moves.
  backend.homethermostatChangeState.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: ['iot:UpdateThingShadow', 'iot:GetThingShadow'],
      resources: [
        Arn.format(
          { service: 'iot', resource: 'thing', resourceName: 'ht-*' },
          Stack.of(backend.homethermostatChangeState.resources.lambda)
        ),
      ],
    })
  );
  homethermostatdevicestate.grant(
    backend.homethermostatChangeState.resources.lambda,
    'dynamodb:Put*',
    'dynamodb:Create*',
    'dynamodb:BatchWriteItem'
  );
}
