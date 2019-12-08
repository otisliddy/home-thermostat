class DynamodbClient {
    constructor(dynamodb) {
        this.dynamodb = dynamodb;
    }
    scan(tableName) {
        const params = {
            TableName: tableName
        }

        return new Promise((resolve, reject) => {
            this.dynamodb.scan(params, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data.Items);
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
                    console.error("Unable to add. Error JSON:", JSON.stringify(err, null, 2));
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
        console.log(params);
        return new Promise((resolve, reject) => {
            this.dynamodb.deleteItem(params, (err, data) => {
                if (err) {
                    console.error("Unable to delete. Error JSON:", JSON.stringify(err, null, 2));
                    reject(err);
                } else {
                    resolve('Deleted item successfully');
                }
            });
        });
    }
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

module.exports = DynamodbClient;
