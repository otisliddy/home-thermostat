const { QueryCommand, PutItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const statusHelper = require('../util/status-helper');
const stateTableName = 'homethermostat-device-state-dev';
const scheduleTableName = 'homethermostat-scheduled-activity-dev';

class DynamodbClient {
    constructor(dynamodb) {
        this.dynamodb = dynamodb;
    }

    async getStatuses(thingName, since) {
        const params = {
            TableName: stateTableName,
            KeyConditionExpression: 'device = :device and since > :since',
            ExpressionAttributeValues: {
                ':device': { S: `${thingName}` },
                ':since': { N: `${since}` }
            }
        };

        try {
            const data = await this.dynamodb.send(new QueryCommand(params));
            let statuses = [];
            data.Items.forEach(status => {
                statuses.push(statusHelper.dynamoItemToStatus(status));
            });
            statuses = statuses.sort((a, b) => (parseInt(a.since) < parseInt(b.since)) ? 1 : -1);
            statuses = statusHelper.findStatusesConsideringDuplicates(statuses);
            return statuses;
        } catch (err) {
            throw err;
        }
    }

    async getScheduledActivity(thingName) {
        const nowSeconds = new Date().getTime() / 1000;
        const params = {
            TableName: scheduleTableName,
            KeyConditionExpression: 'device = :device',
            FilterExpression: '#until > :until',
            ExpressionAttributeValues: {
                ':device': {S: thingName},
                ':until': { N: `${nowSeconds}` }
            },
            ExpressionAttributeNames: {
                '#until': 'until'
            }
        };

        try {
            const data = await this.dynamodb.send(new QueryCommand(params));
            let statuses = [];
            data.Items.forEach(status => {
                statuses.push(statusHelper.dynamoItemToStatus(status));
            });
            return statuses;
        } catch (err) {
            throw err;
        }
    }

    async insertStatus(tableName, status) {
        const params = {
            TableName: tableName,
            Item: statusToDynamoItem(status),
        };
        try {
            await this.dynamodb.send(new PutItemCommand(params));
            return 'Inserted status successfully';
        } catch (err) {
            console.error("Unable to add item, error:", JSON.stringify(err, null, 2));
            throw err;
        }
    }

    async delete(tableName, thingName, since) {
        const params = {
            TableName: tableName,
            Key: {
                'device': {
                    S: `${thingName}`
                },
                'since': {
                    N: since.toString()
                }
            }
        };
        try {
            await this.dynamodb.send(new DeleteItemCommand(params));
            return 'Deleted item successfully';
        } catch (err) {
            console.error("Unable to delete item, error", JSON.stringify(err, null, 2));
            throw err;
        }
    }
}

function statusToDynamoItem(status) {
    const expireAt = new Date();
    const threeYears = 60 * 60 * 24 * 365 * 3;
    expireAt.setTime((status.since + threeYears) * 1000);
    status.expireAt = Math.round(expireAt.getTime() / 1000);

    const item = {};
    for (const key in status) {
        if (status.hasOwnProperty(key)) {
            if (typeof status[key] === 'boolean') {
                item[key] = { BOOL: status[key] }
            } else if (isNaN(status[key])) {
                item[key] = { S: status[key] }
            } else {
                item[key] = { N: status[key].toString() }
            }
        }
    }
    return item;
}

module.exports = DynamodbClient;
