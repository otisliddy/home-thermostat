const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const expect = chai.expect;

const { DynamodbClient, modes } = require('..');
const AWS = require('aws-sdk');
const dynamodbStub = new AWS.DynamoDB();
const dynamodbClient = new DynamodbClient(dynamodbStub);

describe('getStatuses', function () {

    let sinonSandbox;
    let data;

    beforeEach((done) => {
        data = { Items: [] };
        sinonSandbox = sinon.createSandbox();
        sinonSandbox.stub(dynamodbStub, 'query').yields(null, data);
        done();
    });

    afterEach((done) => {
        sinonSandbox.restore();
        done();
    });

    it('no items returns empty array', function (done) {
        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses).to.have.length(0);
            done();
        }).catch((err) => done(err));
    });

    it('only one item', function (done) {
        addDataItem(modes.ON, 1000, { until: 2000 });

        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses).to.have.length(1);
            expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1000, until: 2000 });
            done();
        }).catch((err) => done(err));
    });

    it('ON then OFF', function (done) {
        addDataItem(modes.ON, 900, { until: 2000 });
        addDataItem(modes.OFF, 1000);

        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1000 });
            expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 900, until: 2000 });
            done();
        }).catch((err) => done(err));
    });

    it('ON then OFF reverse order', function (done) {
        addDataItem(modes.OFF, 1000);
        addDataItem(modes.ON, 900, { until: 2000 });

        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1000 });
            expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 900, until: 2000 });
            done();
        }).catch((err) => done(err));
    });

    it('OFF then ON', function (done) {
        addDataItem(modes.OFF, 900);
        addDataItem(modes.ON, 1000, { until: 2000 });

        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1000, until: 2000 });
            expect(statuses[1]).to.eql({ mode: modes.OFF.val, since: 900 });
            done();
        }).catch((err) => done(err));
    });

    it('ON, OFF, OFF', function (done) {
        addDataItem(modes.OFF, 1000);
        addDataItem(modes.ON, 900, { until: 2000 });
        addDataItem(modes.OFF, 1100);

        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1000 });
            expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 900, until: 2000 });
            done();
        }).catch((err) => done(err));
    });

    it('OFF, ON, ON', function (done) {
        addDataItem(modes.OFF, 900);
        addDataItem(modes.ON, 1000, { until: 2000 });
        addDataItem(modes.ON, 1100, { until: 2100 });

        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1000, until: 2100 });
            expect(statuses[1]).to.eql({ mode: modes.OFF.val, since: 900 });
            done();
        }).catch((err) => done(err));
    });

    it('OFF, ON, OFF', function (done) {
        addDataItem(modes.OFF, 900);
        addDataItem(modes.ON, 1000, { until: 2100 });
        addDataItem(modes.OFF, 1100);

        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses).to.have.length(3);
            expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1100 });
            expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 1000, until: 2100 });
            expect(statuses[2]).to.eql({ mode: modes.OFF.val, since: 900 });
            done();
        }).catch((err) => done(err));
    });

    function addDataItem(mode, since, options = {}) {
        const dataItem = {
            mode: { S: mode.val }, since: { N: since.toString() }, expireAt: { N: '100' }
        };
        if (options.until) {
            dataItem.until = { N: options.until.toString() }
        }
        data.Items.push(dataItem);
    }
});