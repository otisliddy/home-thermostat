
const modes = require('../constants/modes');
const AWS = require('../config/aws-config');

const stateTableName = 'thermostatState-test';

class DynamodbClient {
    constructor(dynamodb) {
        if (dynamodb) {
            this.dynamodb = dynamodb;
        } else {
            this.dynamodb = new AWS.DynamoDB();
        }
    }
    scan() {
        const params = {
            TableName: stateTableName
        }

        return new Promise((resolve, reject) => {
            this.dynamodb.scan(params, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(data);
                    const items = data.Items;
                    const itemsSorted = items.sort((a, b) => (parseInt(a.since.N) < parseInt(b.since.N)) ? 1 : -1);
                    resolve(findStatusesConsideringDuplicates(itemsSorted));
                }
            });
        });
    }

    insertStatus(status) {
        const params = {
            TableName: stateTableName,
            Item: statusToDynamoItem(status),
        };
        return new Promise((resolve, reject) => {
            this.dynamodb.putItem(params, (err, data) => {
                if (err) {
                    console.error("Unable to add. Error JSON:", JSON.stringify(err, null, 2));
                    reject(err);
                } else {
                    resolve('Inserted status successfully');
                }
            });
        });
    }
}



function dynamoItemToStatus(dynamoItem) {
    const status = {};
    for (const key in dynamoItem) {
        if (dynamoItem.hasOwnProperty(key) && key !== 'expireAt') {
            if (dynamoItem[key].N) {
                status[key] = parseInt(dynamoItem[key]['N']);
            } else {
                status[key] = dynamoItem[key]['S'];
            }
        }
    }
    return status;
}

function statusToDynamoItem(status) {
    const item = {};

    const expireAt = new Date();
    const sixMonths = 1000 * 60 * 60 * 24 * 183;
    expireAt.setTime(status.since + sixMonths);
    status.expireAt = expireAt.getTime();

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

function findStatusesConsideringDuplicates(items) {
    if (items.length === 0) {
        return [];
    }
    const statuses = [];

    let runningIndex = 0;
    while (runningIndex < items.length) {
        const { status, indexReached } = findStatusConsideringDuplicates(items, runningIndex);
        runningIndex = indexReached + 1;
        statuses.push(status);
    }
    return statuses;
}

function findStatusConsideringDuplicates(items, startingIndex) {
    const startingStatus = dynamoItemToStatus(items[startingIndex]);
    if (startingIndex >= items.length-1) {
        return { status: startingStatus, indexReached: items.length-1 };
    }

    for (let i = startingIndex + 1; i < items.length; i++) {
        const nextStatus = dynamoItemToStatus(items[i]);
        if (nextStatus.mode === startingStatus.mode &&
            nextStatus.fixedTemp === startingStatus.fixedTemp &&
            nextStatus.schedule === startingStatus.schedule) {
                startingStatus.since = nextStatus.since;
        } else if (nextStatus.mode !== startingStatus.mode ||
            nextStatus.fixedTemp !== startingStatus.fixedTemp ||
            nextStatus.schedule !== startingStatus.schedule) {
            return { status: startingStatus, indexReached: i-1 };
        }
    }
    return { status: startingStatus, indexReached: items.length-1 };
}

module.exports = DynamodbClient;
