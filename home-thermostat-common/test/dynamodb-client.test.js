const sinon = require("sinon");
const expect = require("chai").expect;

const { DynamodbClient, modes } = require('..');

const STATE_TABLE = 'homethermostat-device-state-test';
const SCHEDULE_TABLE = 'homethermostat-scheduled-activity-test';

describe('getStatuses', function () {

    let data;
    let dynamodbClient;

    beforeEach(() => {
        data = { Items: [] };
        dynamodbClient = new DynamodbClient({ send: sinon.stub().resolves(data) });
    });

    it('queries the table it was given', async function () {
        const send = sinon.stub().resolves(data);
        await new DynamodbClient({ send }).getStatuses(STATE_TABLE, 'ht-immersion', 500);

        const params = send.firstCall.args[0].input;
        expect(params.TableName).to.equal(STATE_TABLE);
        expect(params.ExpressionAttributeValues[':device'].S).to.equal('ht-immersion');
        expect(params.ExpressionAttributeValues[':since'].N).to.equal('500');
    });

    it('no items returns empty array', async function () {
        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses).to.have.length(0);
    });

    it('only one item', async function () {
        addDataItem(modes.ON, 1000, { until: 2000 });

        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses).to.have.length(1);
        expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1000, until: 2000 });
    });

    it('ON then OFF', async function () {
        addDataItem(modes.ON, 900, { until: 2000 });
        addDataItem(modes.OFF, 1000);

        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses).to.have.length(2);
        expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1000 });
        expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 900, until: 2000 });
    });

    it('ON then OFF reverse order', async function () {
        addDataItem(modes.OFF, 1000);
        addDataItem(modes.ON, 900, { until: 2000 });

        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses).to.have.length(2);
        expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1000 });
        expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 900, until: 2000 });
    });

    it('OFF then ON', async function () {
        addDataItem(modes.OFF, 900);
        addDataItem(modes.ON, 1000, { until: 2000 });

        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses).to.have.length(2);
        expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1000, until: 2000 });
        expect(statuses[1]).to.eql({ mode: modes.OFF.val, since: 900 });
    });

    it('ON, OFF, OFF', async function () {
        addDataItem(modes.OFF, 1000);
        addDataItem(modes.ON, 900, { until: 2000 });
        addDataItem(modes.OFF, 1100);

        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses).to.have.length(2);
        expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1000 });
        expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 900, until: 2000 });
    });

    it('OFF, ON, ON', async function () {
        addDataItem(modes.OFF, 900);
        addDataItem(modes.ON, 1000, { until: 2000 });
        addDataItem(modes.ON, 1100, { until: 2100 });

        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses).to.have.length(2);
        expect(statuses[0]).to.eql({ mode: modes.ON.val, since: 1000, until: 2100 });
        expect(statuses[1]).to.eql({ mode: modes.OFF.val, since: 900 });
    });

    it('OFF, ON, OFF', async function () {
        addDataItem(modes.OFF, 900);
        addDataItem(modes.ON, 1000, { until: 2100 });
        addDataItem(modes.OFF, 1100);

        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses).to.have.length(3);
        expect(statuses[0]).to.eql({ mode: modes.OFF.val, since: 1100 });
        expect(statuses[1]).to.eql({ mode: modes.ON.val, since: 1000, until: 2100 });
        expect(statuses[2]).to.eql({ mode: modes.OFF.val, since: 900 });
    });

    it('keeps the decimals of a temperature target', async function () {
        data.Items.push({
            mode: { S: modes.ON.val },
            since: { N: '1000' },
            dhwTargetTemperature: { N: '41.5' }
        });

        const statuses = await dynamodbClient.getStatuses(STATE_TABLE, 'ht-main', 0);
        expect(statuses[0].dhwTargetTemperature).to.equal(41.5);
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

    it('queries the table it was given', async function () {
        const send = sinon.stub().resolves(data);
        await new DynamodbClient({ send }).getScheduledActivity(SCHEDULE_TABLE, 'ht-immersion');

        const params = send.firstCall.args[0].input;
        expect(params.TableName).to.equal(SCHEDULE_TABLE);
        expect(params.ExpressionAttributeValues[':device'].S).to.equal('ht-immersion');
    });

    it('returns activity that has not started yet', async function () {
        addDataItem(nowSeconds + 3600, { until: nowSeconds + 7200 });

        const statuses = await dynamodbClient.getScheduledActivity(SCHEDULE_TABLE, 'ht-main');
        expect(statuses).to.have.length(1);
        expect(statuses[0].since).to.equal(nowSeconds + 3600);
    });

    it('returns activity that has started but not finished', async function () {
        addDataItem(nowSeconds - 600);

        const statuses = await dynamodbClient.getScheduledActivity(SCHEDULE_TABLE, 'ht-main');
        expect(statuses).to.have.length(1);
    });

    it('does not return activity that has finished', async function () {
        addDataItem(nowSeconds - 600, { until: nowSeconds - 300 });

        const statuses = await dynamodbClient.getScheduledActivity(SCHEDULE_TABLE, 'ht-main');
        expect(statuses).to.have.length(0);
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
