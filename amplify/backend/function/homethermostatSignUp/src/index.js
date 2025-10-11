/* Amplify Params - DO NOT EDIT
    ENV
    REGION
Amplify Params - DO NOT EDIT */
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({ region: process.env.REGION });

exports.handler = async function (event) {
    console.log('event', event);
    const params = {
        Destination: {
            ToAddresses: ['otisliddy@gmail.com']
        },
        Message: {
            Body: {
                Text: { Data: "New user " + event.request.userAttributes.email + " has requested signup. To confirm user go to AWS Console -> Cognito -> User pools -> homethermostat -> Users." },
            },
            Subject: { Data: "Home Thermostat signup" },
        },
        Source: 'otisliddy@gmail.com',
    };

    try {
        await sesClient.send(new SendEmailCommand(params));
        return event;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};
