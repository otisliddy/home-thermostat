import type { Backend } from '../../backend';
import {
  Table,
  AttributeType,
  BillingMode,
  StreamViewType,
  CfnTable,
} from 'aws-cdk-lib/aws-dynamodb';
import { CfnResource } from 'aws-cdk-lib';

export function defineStorageHomethermostatScheduledActivity(backend: Backend) {
  const storageHomethermostatScheduledActivityStack = backend.createStack(
    'storagehomethermostatScheduledActivity'
  );
  const table = new Table(
    storageHomethermostatScheduledActivityStack,
    'homethermostat_scheduled_activity',
    {
      partitionKey: { name: 'device', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_IMAGE,
      sortKey: { name: 'since', type: AttributeType.NUMBER },
    }
  );
  for (const cfnResource of storageHomethermostatScheduledActivityStack.node
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

export function postRefactor(homethermostat_scheduled_activity: Table, suffix: string) {
  (homethermostat_scheduled_activity.node.defaultChild as CfnTable).tableName = `homethermostat-scheduled-activity-${suffix}`;
}
