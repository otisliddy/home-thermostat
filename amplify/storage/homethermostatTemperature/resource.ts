import type { Backend } from '../../backend';
import {
  Table,
  AttributeType,
  BillingMode,
  StreamViewType,
  CfnTable,
} from 'aws-cdk-lib/aws-dynamodb';
import { CfnResource } from 'aws-cdk-lib';

export function defineStorageHomethermostatTemperature(backend: Backend) {
  const storageHomethermostatTemperatureStack = backend.createStack(
    'storagehomethermostatTemperature'
  );
  const table = new Table(
    storageHomethermostatTemperatureStack,
    'homethermostat_temperature',
    {
      partitionKey: { name: 'device', type: AttributeType.STRING },
      billingMode: BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      stream: StreamViewType.NEW_IMAGE,
      sortKey: { name: 'timestamp', type: AttributeType.NUMBER },
    }
  );
  for (const cfnResource of storageHomethermostatTemperatureStack.node
    .findAll()
    .filter(
      (c) =>
        CfnResource.isCfnResource(c) &&
        c.cfnResourceType === 'AWS::DynamoDB::Table'
    )) {
    (cfnResource as CfnResource).addOverride('UpdateReplacePolicy', 'Retain');
    (cfnResource as CfnResource).addOverride('DeletionPolicy', 'Retain');
  }

  return table;
}

export function postRefactor(homethermostat_temperature: Table) {
  (homethermostat_temperature.node.defaultChild as CfnTable).tableName =
    'homethermostat-temperature-dev';
}
