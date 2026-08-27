import { defineFunction } from '@aws-amplify/backend';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import type { Backend } from '../../backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

export const homethermostatChangeState = defineFunction({
  entry: './index.js',
  name: `homethermostatChangeState-${branchName}`,
  timeoutSeconds: 25,
  memoryMB: 128,
  environment: { ENV: `${branchName}`, REGION: 'eu-west-1' },
  runtime: 22,
  schedule: '5,35 14 * * ? *',
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
  homethermostatdevicestate.grant(
    backend.homethermostatChangeState.resources.lambda,
    'dynamodb:Put*',
    'dynamodb:Create*',
    'dynamodb:BatchWriteItem'
  );
}
