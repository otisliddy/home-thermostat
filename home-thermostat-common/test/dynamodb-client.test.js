const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const expect = chai.expect;

const { DynamodbClient, modes, AWS } = require('..');
const dynamodbStub = new AWS.DynamoDB();
const dynamodbClient = new DynamodbClient(dynamodbStub);

describe('Scan', function () {

    let sinonSandbox;
    let data;

    beforeEach((done) => {
        data = { Items: [] };
        sinonSandbox = sinon.createSandbox();
        sinonSandbox.stub(dynamodbStub, 'scan').yields(null, data);
        done();
    });

    afterEach((done) => {
        sinonSandbox.restore();
        done();
    });

    it('no items returns empty array', function (done) {
        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(0);
            done();
        }).catch((err) => done(err));
    });

    it('only one item', function (done) {
        addDataItem(modes.ON, 1000, { until: 2000 });

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(1);
            expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1000, until: 2000 });
            done();
        }).catch((err) => done(err));
    });

    it('ON then OFF', function (done) {
        addDataItem(modes.ON, 900, { until: 2000 });
        addDataItem(modes.OFF, 1000);

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1000 });
            expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 900, until: 2000 });
            done();
        }).catch((err) => done(err));
    });

    it('ON then OFF reverse order', function (done) {
        addDataItem(modes.OFF, 1000);
        addDataItem(modes.ON, 900, { until: 2000 });

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1000 });
            expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 900, until: 2000 });
            done();
        }).catch((err) => done(err));
    });

    it('OFF then ON', function (done) {
        addDataItem(modes.OFF, 900);
        addDataItem(modes.ON, 1000, { until: 2000 });

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1000, until: 2000 });
            expect(statuses[1]).to.eql({ mode: modes.OFF.val, since: 900 });
            done();
        }).catch((err) => done(err));
    });

    it('FIXED_TEMP, FIXED_TEMP with same temp', function (done) {
        addDataItem(modes.FIXED_TEMP, 1000, { temp: 19 });
        addDataItem(modes.FIXED_TEMP, 1100, { temp: 19 });

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(1);
            expect(statuses[0]).to.eql({ mode: modes.FIXED_TEMP.val, since: 1000, temp: 19 });
            done();
        }).catch((err) => done(err));
    });

    it('FIXED_TEMP, FIXED_TEMP with different temp', function (done) {
        addDataItem(modes.FIXED_TEMP, 900, { temp: 18 });
        addDataItem(modes.FIXED_TEMP, 1100, { temp: 19 });

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.FIXED_TEMP.val, since: 1100, temp: 19 });
            expect(statuses[1]).to.eql({ mode: modes.FIXED_TEMP.val, since: 900, temp: 18 });
            done();
        }).catch((err) => done(err));
    });

    it('ON, OFF, OFF', function (done) {
        addDataItem(modes.OFF, 1000);
        addDataItem(modes.ON, 900, { until: 2000 });
        addDataItem(modes.OFF, 1100);

        dynamodbClient.scan().then((statuses) => {
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

        dynamodbClient.scan().then((statuses) => {
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

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(3);
            expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1100 });
            expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 1000, until: 2100 });
            expect(statuses[2]).to.eql({ mode: modes.OFF.val, since: 900 });
            done();
        }).catch((err) => done(err));
    });

    it('FIXED_TEMP, ON, FIXED_TEMP', function (done) {
        addDataItem(modes.FIXED_TEMP, 900, { temp: 18 });
        addDataItem(modes.ON, 1000, { until: 2100 });
        addDataItem(modes.FIXED_TEMP, 1100, { temp: 19 });

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(3);
            expect(statuses[0]).to.eql({ mode: modes.FIXED_TEMP.val, since: 1100, temp: 19 });
            expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 1000, until: 2100 });
            expect(statuses[2]).to.eql({ mode: modes.FIXED_TEMP.val, since: 900, temp: 18 });
            done();
        }).catch((err) => done(err));
    });

    it('OFF, FIXED_TEMP, FIXED_TEMP with same temp', function (done) {
        addDataItem(modes.OFF, 900);
        addDataItem(modes.FIXED_TEMP, 1000, { temp: 19 });
        addDataItem(modes.FIXED_TEMP, 1100, { temp: 19 });

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(2);
            expect(statuses[0]).to.eql({ mode: modes.FIXED_TEMP.val, since: 1000, temp: 19 });
            expect(statuses[1]).to.eql({ mode: modes.OFF.val, since: 900 });
            done();
        }).catch((err) => done(err));
    });

    it('ON, FIXED_TEMP, ON', function (done) {
        addDataItem(modes.ON, 1000, { until: 1900 });
        addDataItem(modes.FIXED_TEMP, 1100, { temp: 19 });
        addDataItem(modes.ON, 1200, { until: 2100 });

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(3);
            expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1200, until: 2100 });
            expect(statuses[1]).to.eql({ mode: modes.FIXED_TEMP.val, since: 1100, temp: 19 });
            expect(statuses[2]).to.eql({ mode: modes.ON.val, since: 1000, until: 1900 });
            done();
        }).catch((err) => done(err));
    });

    it('ON, ON, ON, OFF, FIXED_TEMP, FIXED_TEMP, FIXED_TEMP, OFF, OFF', function (done) {
        addDataItem(modes.ON, 1000, { until: 1900 });
        addDataItem(modes.ON, 1100, { until: 2000 });
        addDataItem(modes.ON, 1200, { until: 2100 });
        addDataItem(modes.OFF, 1300);
        addDataItem(modes.FIXED_TEMP, 1400, { temp: 19 });
        addDataItem(modes.FIXED_TEMP, 1500, { temp: 19 });
        addDataItem(modes.FIXED_TEMP, 1600, { temp: 20 });
        addDataItem(modes.OFF, 1700);
        addDataItem(modes.OFF, 1800);

        dynamodbClient.scan().then((statuses) => {
            expect(statuses).to.have.length(5);
            expect(statuses[4]).to.eql({ mode: modes.ON.val, since: 1000, until: 2100 });
            expect(statuses[3]).to.eql({ mode: modes.OFF.val, since: 1300 });
            expect(statuses[2]).to.eql({ mode: modes.FIXED_TEMP.val, since: 1400, temp: 19 });
            expect(statuses[1]).to.eql({ mode: modes.FIXED_TEMP.val, since: 1600, temp: 20 });
            expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1700 });
            done();
        }).catch((err) => done(err));
    });

    function addDataItem(mode, since, options = {}) {
        const dataItem = {
            mode: { S: mode.val }, since: { N: since.toString() }, expireAt: { N: '99999999' }
        };
        if (options.until) {
            dataItem.until = { N: options.until.toString() }
        }
        if (options.temp) {
            dataItem.temp = { N: options.temp.toString() }
        }
        data.Items.push(dataItem);
    }
});