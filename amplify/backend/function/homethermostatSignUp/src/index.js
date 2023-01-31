/* Amplify Params - DO NOT EDIT
    ENV
    REGION
Amplify Params - DO NOT EDIT */
const AWS = require('aws-sdk');
AWS.config.region = process.env.REGION
var ses = new AWS.SES();

exports.handler = async function (event) {
    console.log('event', event);
    const params = {
        Destination: {
            ToAddresses: ['otisliddy@gmail.com']
        },
        Message: {
            Body: {
                Text: { Data: "New user " + event.request.userAttributes.email + " has requested signup. Go to AWS Console -> Cognito -> User pools to confirm user." },
            },

            Subject: { Data: "Home Thermostat signup" },
        },
        Source: 'otisliddy@gmail.com',
    };

    return ses.sendEmail(params).promise().then(() => {
        return event;
    });

};
