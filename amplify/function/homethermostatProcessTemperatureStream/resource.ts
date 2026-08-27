import { defineFunction } from '@aws-amplify/backend';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import type { Backend } from '../../backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

export const homethermostatProcessTemperatureStream = defineFunction({
  entry: './index.js',
  name: `homethermostatProcessTemperatureStream-${branchName}`,
  timeoutSeconds: 25,
  memoryMB: 128,
  environment: { ENV: `${branchName}`, REGION: 'eu-west-1' },
  runtime: 22,
});

export function applyEscapeHatches(
  backend: Backend,
  homethermostatscheduledactivity: Table,
  homethermostattemperature: Table
) {
  backend.homethermostatProcessTemperatureStream.resources.cfnResources.cfnFunction.functionName = `homethermostatProcessTemperatureStream-${branchName}`;
  backend.homethermostatProcessTemperatureStream.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_STREAMARN',
    homethermostatscheduledactivity.tableStreamArn!
  );
  backend.homethermostatProcessTemperatureStream.addEnvironment(
    'STORAGE_HOMETHERMOSTATTEMPERATURE_STREAMARN',
    homethermostattemperature.tableStreamArn!
  );
  backend.homethermostatProcessTemperatureStream.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_ARN',
    homethermostatscheduledactivity.tableArn
  );
  backend.homethermostatProcessTemperatureStream.addEnvironment(
    'STORAGE_HOMETHERMOSTATTEMPERATURE_ARN',
    homethermostattemperature.tableArn
  );
  backend.homethermostatProcessTemperatureStream.addEnvironment(
    'STORAGE_HOMETHERMOSTATTEMPERATURE_NAME',
    homethermostattemperature.tableName
  );
  backend.homethermostatProcessTemperatureStream.addEnvironment(
    'STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME',
    homethermostatscheduledactivity.tableName
  );
  homethermostatscheduledactivity.grant(
    backend.homethermostatProcessTemperatureStream.resources.lambda,
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
    'dynamodb:Get*',
    'dynamodb:BatchGetItem',
    'dynamodb:List*',
    'dynamodb:Describe*',
    'dynamodb:Scan',
    'dynamodb:Query',
    'dynamodb:PartiQLSelect'
  );
  homethermostattemperature.grant(
    backend.homethermostatProcessTemperatureStream.resources.lambda,
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
    'dynamodb:Get*',
    'dynamodb:BatchGetItem',
    'dynamodb:List*',
    'dynamodb:Describe*',
    'dynamodb:Scan',
    'dynamodb:Query',
    'dynamodb:PartiQLSelect'
  );
  backend.homethermostatProcessTemperatureStream.resources.lambda.addEventSource(
    new DynamoEventSource(homethermostattemperature, {
      startingPosition: StartingPosition.LATEST,
    })
  );
  homethermostattemperature.grantStreamRead(
    backend.homethermostatProcessTemperatureStream.resources.lambda.role!
  );
  homethermostattemperature.grantTableListStreams(
    backend.homethermostatProcessTemperatureStream.resources.lambda.role!
  );
}
