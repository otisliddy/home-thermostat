const statusHelper = require('../util/status-helper');
const stateTableName = 'homethermostat-device-state-dev';
const scheduleTableName = 'homethermostat-scheduled-activity-dev';

class DynamodbClient {
    constructor(dynamodb) {
        this.dynamodb = dynamodb;
    }

    getStatuses(thingName, since) {
        const params = {
            TableName: stateTableName,
            KeyConditionExpression: 'device = :device and since > :since',
            ExpressionAttributeValues: {
                ':device': {S: `${thingName}`},
                ':since': {N: `${since}`}
            }
        }

        return new Promise((resolve, reject) => {
            this.dynamodb.query(params, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    let statuses = [];
                    data.Items.forEach(status => {
                        statuses.push(statusHelper.dynamoItemToStatus(status));
                    });
                    statuses = statuses.sort((a, b) => (parseInt(a.since) < parseInt(b.since)) ? 1 : -1);
                    statuses = statusHelper.findStatusesConsideringDuplicates(statuses);
                    resolve(statuses);
                }
            });
        });
    }

    async getScheduledActivity(thingName) {
        const nowSeconds = new Date().getTime() / 1000;
        return new Promise((resolve, reject) => {
            // Need 2 queries because a key attribute (device + since) and non-key attribute (recurring) cannot be
            // mixed in a single query

            // Query 1: since > now
            const query1 = {
                TableName: scheduleTableName,
                KeyConditionExpression: 'device = :device AND since > :since',
                ExpressionAttributeValues: {
                    ':device': {S: thingName},
                    ':since': {N: `${nowSeconds}`}
                }
            };

            // Query 2: recurring activities
            const recurringParams = {
                TableName: scheduleTableName,
                KeyConditionExpression: 'device = :device',
                FilterExpression: 'recurring = :recurring',
                ExpressionAttributeValues: {
                    ':device': {S: thingName},
                    ':recurring': {BOOL: true}
                }
            };

            Promise.all([
                new Promise((res, rej) => {
                    this.dynamodb.query(query1, (err, data) => {
                        if (err) return rej(err);
                        res(data.Items || []);
                    });
                }),
                new Promise((res, rej) => {
                    this.dynamodb.query(recurringParams, (err, data) => {
                        if (err) return rej(err);
                        res(data.Items || []);
                    });
                })
            ])
                .then(([futureItems, recurringItems]) => {
                    // Merge and map through your helper
                    const allItems = [...futureItems, ...recurringItems];
                    const statuses = allItems.map(status => statusHelper.dynamoItemToStatus(status));
                    resolve(statuses);
                })
                .catch(reject);
        });
    }

    insertStatus(tableName, status) {
        const params = {
            TableName: tableName,
            Item: statusToDynamoItem(status),
        };
        return new Promise((resolve, reject) => {
            this.dynamodb.putItem(params, (err, data) => {
                if (err) {
                    console.error("Unable to add item, error:", JSON.stringify(err, null, 2));
                    reject(err);
                } else {
                    resolve('Inserted status successfully');
                }
            });
        });
    }

    delete(tableName, thingName, since) {
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
        return new Promise((resolve, reject) => {
            this.dynamodb.deleteItem(params, (err, data) => {
                if (err) {
                    console.error("Unable to delete item, error", JSON.stringify(err, null, 2));
                    reject(err);
                } else {
                    resolve('Deleted item successfully');
                }
            });
        });
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
                item[key] = {BOOL: status[key]}
            } else if (isNaN(status[key])) {
                item[key] = {S: status[key]}
            } else {
                item[key] = {N: status[key].toString()}
            }
        }
    }
    return item;
}

module.exports = DynamodbClient;
