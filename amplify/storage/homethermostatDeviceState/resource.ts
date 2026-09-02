import type { Backend } from '../../backend';
import {
  Table,
  AttributeType,
  BillingMode,
  StreamViewType,
  CfnTable,
} from 'aws-cdk-lib/aws-dynamodb';
import { CfnResource } from 'aws-cdk-lib';

export function defineStorageHomethermostatDeviceState(backend: Backend) {
  const storageHomethermostatDeviceStateStack = backend.createStack(
    'storagehomethermostatDeviceState'
  );
  const table = new Table(
    storageHomethermostatDeviceStateStack,
    'homethermostat_device_state',
    {
      partitionKey: { name: 'device', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_IMAGE,
      sortKey: { name: 'since', type: AttributeType.NUMBER },
    }
  );
  for (const cfnResource of storageHomethermostatDeviceStateStack.node
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

export function postRefactor(homethermostat_device_state: Table, suffix: string) {
  (homethermostat_device_state.node.defaultChild as CfnTable).tableName = `homethermostat-device-state-${suffix}`;
}
