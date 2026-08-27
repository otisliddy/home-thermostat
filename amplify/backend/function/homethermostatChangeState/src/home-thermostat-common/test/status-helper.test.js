const expect = require('chai').expect;
const statusHelper = require('../src/util/status-helper');
const { modes } = require('../src/constants/modes');

it('should create a status from off mode', function () {
    const status = statusHelper.createStatus('device-name', modes.OFF.val);
    expect(status).to.have.property('mode');
    expect(status).to.have.property('since');
    expect(status).not.to.have.property('until');
});

it('should create a status from on mode', function () {
    const status = statusHelper.createStatus('device-name', modes.ON.val, {duration: 900});
    expect(status).to.have.property('mode');
    expect(status).to.have.property('since');
    expect(status).to.have.property('until');
});

it('should create a status with execution ARN', function () {
    const status = statusHelper.createStatus('device-name', modes.ON.val,  {duration: 900, executionArn: '"ARN"' });
    expect(status).to.have.property('mode');
    expect(status).to.have.property('since');
    expect(status).to.have.property('until');
    expect(status).to.have.property('executionArn');
    expect(status.executionArn).to.be.equal('ARN');
});

describe('findNextStatusForDevice', function () {
    const statuses = [
        { device: 'ht-immersion', mode: modes.OFF.val, since: 400 },
        { device: 'ht-main', mode: modes.OFF.val, since: 300 },
        { device: 'ht-immersion', mode: modes.ON.val, since: 200 },
        { device: 'ht-main', mode: modes.ON.val, since: 100 },
    ];

    it('skips statuses of other devices', function () {
        const next = statusHelper.findNextStatusForDevice(statuses, 3);
        expect(next).to.eql(statuses[1]);
    });

    it('returns null for the most recent status of a device', function () {
        expect(statusHelper.findNextStatusForDevice(statuses, 0)).to.be.null;
    });
});

describe('getActualEndTime', function () {
    it('uses the next status when the heating was turned off early', function () {
        const status = { since: 100, until: 900 };
        const nextStatus = { since: 500 };

        expect(statusHelper.getActualEndTime(status, nextStatus)).to.equal(500);
    });

    it('does not run past until when no off was recorded', function () {
        const status = { since: 100, until: 900 };
        const nextStatus = { since: 90000 };

        expect(statusHelper.getActualEndTime(status, nextStatus)).to.equal(900);
    });

    it('uses until when there is no next status', function () {
        expect(statusHelper.getActualEndTime({ since: 100, until: 900 }, null)).to.equal(900);
    });

    it('uses the current time while still running', function () {
        expect(statusHelper.getActualEndTime({ since: 100 }, null, 500000)).to.equal(500);
    });
});
