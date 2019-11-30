const AWS = require('aws-sdk');

const identityPoolId = 'eu-west-1:12319816-c5b9-4593-8dae-129cfab87abf';
AWS.config.region = 'eu-west-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: identityPoolId,
});

module.exports = AWS;
