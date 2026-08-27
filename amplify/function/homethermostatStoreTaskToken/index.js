/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_ARN
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamodbClient = new DynamoDBClient({ region: process.env.REGION });
const scheduledActivityTableName = process.env.STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME;

/**
 * Lambda function to store the Step Functions task token in DynamoDB.
 * This function is called with .waitForTaskToken, so it returns immediately
 * but the state machine waits for an external SendTaskSuccess call.
 */
exports.handler = async (event) => {
    console.log('Store Task Token Event:', JSON.stringify(event));

    const { taskToken, thingName, since, dhwTargetTemperature } = event;

    if (!taskToken || !thingName || !since) {
        throw new Error('Missing required parameters: taskToken, thingName, or since');
    }

    // Build update expression and attribute values dynamically
    let updateExpression = 'SET taskToken = :taskToken';
    const expressionAttributeValues = {
        ':taskToken': { S: taskToken }
    };

    // Add dhwTargetTemperature if provided
    if (dhwTargetTemperature !== undefined && dhwTargetTemperature !== null) {
        updateExpression += ', dhwTargetTemperature = :dhwTargetTemperature';
        expressionAttributeValues[':dhwTargetTemperature'] = { N: dhwTargetTemperature.toString() };
    }

    const params = {
        TableName: scheduledActivityTableName,
        Key: {
            'device': { S: thingName },
            'since': { N: since.toString() }
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues
    };

    try {
        const command = new UpdateItemCommand(params);
        await dynamodbClient.send(command);
        console.log(`Successfully stored task token for device: ${thingName}, since: ${since}${dhwTargetTemperature ? `, dhwTargetTemperature: ${dhwTargetTemperature}` : ''}`);

        return {
            statusCode: 200,
            message: 'Task token stored successfully'
        };
    } catch (err) {
        console.error('Error storing task token:', err);
        throw err;
    }
};
