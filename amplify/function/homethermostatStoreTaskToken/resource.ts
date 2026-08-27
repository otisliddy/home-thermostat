import { defineFunction } from '@aws-amplify/backend';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import type { Backend } from '../../backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

export const homethermostatStoreTaskToken = defineFunction({
  entry: './index.js',
  name: `homethermostatStoreTaskToken-${branchName}`,
  timeoutSeconds: 25,
  memoryMB: 128,
  environment: { ENV: `${branchName}`, REGION: 'eu-west-1' },
  runtime: 22,
});

export function applyEscapeHatches(
  backend: Backend,
  homethermostatscheduledactivity: Table
) {
  backend.homethermostatStoreTaskToken.resources.cfnResources.cfnFunction.functionName = `homethermostatStoreTaskToken-${branchName}`;
  backend.homethermostatStoreTaskToken.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_STREAMARN',
    homethermostatscheduledactivity.tableStreamArn!
  );
  backend.homethermostatStoreTaskToken.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_ARN',
    homethermostatscheduledactivity.tableArn
  );
  backend.homethermostatStoreTaskToken.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME',
    homethermostatscheduledactivity.tableName
  );
  homethermostatscheduledactivity.grant(
    backend.homethermostatStoreTaskToken.resources.lambda,
    'dynamodb:Put*',
    'dynamodb:Create*',
    'dynamodb:BatchWriteItem',
    'dynamodb:PartiQLInsert',
    'dynamodb:Get*',
    'dynamodb:BatchGetItem',
    'dynamodb:List*',
    'dynamodb:Describe*',
    'dynamodb:Scan',
    'dynamodb:Query',
    'dynamodb:PartiQLSelect',
    'dynamodb:Update*',
    'dynamodb:RestoreTable*',
    'dynamodb:PartiQLUpdate'
  );
}
