import { defineFunction } from '@aws-amplify/backend';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import type { Backend } from '../../backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

export const homethermostatStartScheduleStateChange = defineFunction({
  entry: './index.js',
  name: `homethermostatStartScheduleStateChange-${branchName}`,
  timeoutSeconds: 25,
  memoryMB: 128,
  environment: { ENV: `${branchName}`, REGION: 'eu-west-1' },
  runtime: 22,
});

export function applyEscapeHatches(
  backend: Backend,
  homethermostatscheduledactivity: Table
) {
  backend.homethermostatStartScheduleStateChange.resources.cfnResources.cfnFunction.functionName = `homethermostatStartScheduleStateChange-${branchName}`;
  backend.homethermostatStartScheduleStateChange.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_STREAMARN',
    homethermostatscheduledactivity.tableStreamArn!
  );
  backend.homethermostatStartScheduleStateChange.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_ARN',
    homethermostatscheduledactivity.tableArn
  );
  backend.homethermostatStartScheduleStateChange.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME',
    homethermostatscheduledactivity.tableName
  );
  homethermostatscheduledactivity.grant(
    backend.homethermostatStartScheduleStateChange.resources.lambda,
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
    'dynamodb:PartiQLUpdate',
    'dynamodb:Delete*',
    'dynamodb:PartiQLDelete'
  );
}
