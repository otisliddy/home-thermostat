
const modes = require('../constants/modes');
const AWS = require('../config/aws-config');

const dynamodb = new AWS.DynamoDB();
const stateTableName = 'thermostatState-test';
const dynamodbClient = {};

dynamodbClient.scan = () => {
    const params = {
        TableName: stateTableName
    }

    return new Promise((resolve, reject) => {
        dynamodb.scan(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                const items = data.Items;
                const itemsSorted = items.sort((a, b) => (a.since.N < b.since.N) ? 1 : -1);
                resolve(findStatusConsideringDuplicates(itemsSorted));
            }
        });
    });
}

dynamodbClient.insertStatus = (status) => {
    const params = {
        TableName: stateTableName,
        Item: statusToDynamoItem(status),
    };
    return new Promise((resolve, reject) => {
        dynamodb.putItem(params, (err, data) => {
            if (err) {
                console.error("Unable to add. Error JSON:", JSON.stringify(err, null, 2));
                reject(err);
            } else {
                resolve('Inserted status successfully');
            }
        });
    });
}

function dynamoItemToStatus(dynamoItem) {
    const status = {};
    for (const key in dynamoItem) {
        if (dynamoItem.hasOwnProperty(key)) {
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

function findStatusConsideringDuplicates(items) {
    if (items.length === 0) {
        return { mode: modes.OFF.val };
    }
    const latestStatus = dynamoItemToStatus(items[0]);
    if (items.length === 1) {
        return latestStatus;
    }

    for (let i = 1; i < items.length; i++) {
        const nextStatus = dynamoItemToStatus(items[i]);
        if (nextStatus.mode !== latestStatus.mode ||
            nextStatus.fixedTemp !== latestStatus.fixedTemp ||
            nextStatus.schedule !== latestStatus.schedule) {
            latestStatus.since = dynamoItemToStatus(items[i - 1]).since;
            return latestStatus;
        }
    }
    return latestStatus;
}

module.exports = dynamodbClient;
