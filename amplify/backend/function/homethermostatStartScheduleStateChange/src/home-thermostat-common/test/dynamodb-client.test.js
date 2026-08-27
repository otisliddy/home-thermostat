const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const expect = chai.expect;

const { DynamodbClient, modes } = require('..');

describe('getStatuses', function () {

    let data;
    let dynamodbClient;

    beforeEach(() => {
        data = { Items: [] };
        dynamodbClient = new DynamodbClient({ send: sinon.stub().resolves(data) });
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

    it('keeps the decimals of a temperature target', function (done) {
        data.Items.push({
            mode: { S: modes.ON.val },
            since: { N: '1000' },
            dhwTargetTemperature: { N: '41.5' }
        });

        dynamodbClient.getStatuses().then((statuses) => {
            expect(statuses[0].dhwTargetTemperature).to.equal(41.5);
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

describe('getScheduledActivity', function () {

    const nowSeconds = Math.floor(Date.now() / 1000);
    let data;
    let dynamodbClient;

    beforeEach(() => {
        data = { Items: [] };
        dynamodbClient = new DynamodbClient({ send: sinon.stub().resolves(data) });
    });

    it('returns activity that has not started yet', function (done) {
        addDataItem(nowSeconds + 3600, { until: nowSeconds + 7200 });

        dynamodbClient.getScheduledActivity('ht-main').then((statuses) => {
            expect(statuses).to.have.length(1);
            expect(statuses[0].since).to.equal(nowSeconds + 3600);
            done();
        }).catch((err) => done(err));
    });

    it('returns activity that has started but not finished', function (done) {
        addDataItem(nowSeconds - 600);

        dynamodbClient.getScheduledActivity('ht-main').then((statuses) => {
            expect(statuses).to.have.length(1);
            done();
        }).catch((err) => done(err));
    });

    it('does not return activity that has finished', function (done) {
        addDataItem(nowSeconds - 600, { until: nowSeconds - 300 });

        dynamodbClient.getScheduledActivity('ht-main').then((statuses) => {
            expect(statuses).to.have.length(0);
            done();
        }).catch((err) => done(err));
    });

    function addDataItem(since, options = {}) {
        const dataItem = {
            device: { S: 'ht-main' }, mode: { S: modes.ON.val }, since: { N: since.toString() }
        };
        if (options.until) {
            dataItem.until = { N: options.until.toString() }
        }
        data.Items.push(dataItem);
    }
});
