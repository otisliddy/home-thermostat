const AWS = require('aws-sdk');

const identityPoolId = 'eu-west-1:2200778e-6367-4071-9d85-d075b8c2fd2b';
AWS.config.region = 'eu-west-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: identityPoolId,
});

module.exports = AWS;
