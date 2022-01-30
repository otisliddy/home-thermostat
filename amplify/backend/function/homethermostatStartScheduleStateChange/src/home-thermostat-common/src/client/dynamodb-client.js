const statusHelper = require('../util/status-helper');
const stateTableName = 'thermostatState-test';
const scheduleTableName = 'scheduledActivity-test';

class DynamodbClient {
    constructor(dynamodb) {
        this.dynamodb = dynamodb;
    }

    getStatuses() {
        const params = {
            TableName: stateTableName
        }

        return new Promise((resolve, reject) => {
            this.dynamodb.scan(params, (err, data) => {
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

    getScheduledActivity() {
        const params = {
            TableName: scheduleTableName
        }

        return new Promise((resolve, reject) => {
            this.dynamodb.scan(params, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    let statuses = [];
                    data.Items.forEach(status => {
                        statuses.push(statusHelper.dynamoItemToStatus(status));
                    });
                    resolve(statuses);
                }
            });
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

    delete(tableName, since) {
        const params = {
            TableName: tableName,
            Key: {
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
    status.device = 'ht-main';
    
    const expireAt = new Date();
    const sixMonths = 1000 * 60 * 60 * 24 * 183;
    expireAt.setTime(status.since + sixMonths);
    status.expireAt = expireAt.getTime();

    const item = {};
    for (const key in status) {
        if (status.hasOwnProperty(key)) {
            if (isNaN(status[key])) {
                item[key] = { S: status[key] }
            } else {
                item[key] = { N: status[key].toString() }
            }
        }
    }
    return item;
}

module.exports = DynamodbClient;
