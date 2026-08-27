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

    /**
     * Returns the activity that is still to come, plus any activity that started in the last
     * day and has not finished yet (an 'until' is only written once the activity completes).
     * In-progress activity has to be included, otherwise a running DHW heat-up is invisible
     * to the UI and its step function execution cannot be cancelled.
     */
    async getScheduledActivity(thingName) {
        const nowSeconds = Math.floor(new Date().getTime() / 1000);
        const oneDayAgoSeconds = nowSeconds - 24 * 60 * 60;
        const params = {
            TableName: scheduleTableName,
            KeyConditionExpression: 'device = :device AND since > :since',
            ExpressionAttributeValues: {
                ':device': {S: thingName},
                ':since': {N: `${oneDayAgoSeconds}`}
            }
        };

        try {
            const data = await this.dynamodb.send(new QueryCommand(params));
            const statuses = [];
            data.Items.forEach(item => {
                const status = statusHelper.dynamoItemToStatus(item);
                if (status.since > nowSeconds || !status.until) {
                    statuses.push(status);
                }
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

    async getLatestTemperature(tableName, device) {
        const params = {
            TableName: tableName,
            KeyConditionExpression: 'device = :device',
            ExpressionAttributeValues: {
                ':device': { S: device }
            },
            ScanIndexForward: false,
            Limit: 1
        };

        try {
            const data = await this.dynamodb.send(new QueryCommand(params));
            if (data.Items && data.Items.length > 0) {
                const item = data.Items[0];
                return {
                    device: item.device?.S,
                    timestamp: parseInt(item.timestamp?.N),
                    temperature: parseFloat(item.temperature?.N)
                };
            }
            return null;
        } catch (err) {
            console.error("Unable to get latest temperature, error:", JSON.stringify(err, null, 2));
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
            } else if (isNumeric(status[key])) {
                item[key] = { N: status[key].toString() }
            } else {
                item[key] = { S: status[key] }
            }
        }
    }
    return item;
}

/*
* Empty strings and null are not numbers, even though isNaN() says otherwise. Writing them
* as a DynamoDB number would be rejected by DynamoDB at runtime.
*/
function isNumeric(value) {
    if (typeof value === 'number') {
        return isFinite(value);
    }
    return typeof value === 'string' && value.trim() !== '' && !isNaN(value);
}

module.exports = DynamodbClient;
