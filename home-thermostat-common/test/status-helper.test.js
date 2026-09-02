const expect = require('chai').expect;
const statusHelper = require('../src/util/status-helper');
const { modes } = require('../src/constants/modes');
const { endReasons } = require('../src/constants/end-reasons');

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

describe('isScheduledActivityRunning', () => {
    const now = 1787864226;
    const nowMillis = now * 1000;

    it('an activity that has not started yet is still pending', () => {
        const activity = { since: now + 3600, until: now + 7200 };
        expect(statusHelper.isScheduledActivityRunning(activity, [], nowMillis)).to.equal(true);
    });

    it('an activity inside its window is running', () => {
        const activity = { since: now - 600, until: now + 600 };
        expect(statusHelper.isScheduledActivityRunning(activity, [], nowMillis)).to.equal(true);
    });

    it('an activity past its until has finished', () => {
        const activity = { since: now - 3600, until: now - 600 };
        expect(statusHelper.isScheduledActivityRunning(activity, [], nowMillis)).to.equal(false);
    });

    it('an open-ended activity with no later off is still running', () => {
        const activity = { since: now - 600 };
        const statuses = [{ mode: modes.ON.val, since: now - 600 }];
        expect(statusHelper.isScheduledActivityRunning(activity, statuses, nowMillis)).to.equal(true);
    });

    // The aborted DHW run: the execution died at 19:40 without ever writing an until, so only the
    // recorded Off tells us it ended.
    it('an open-ended activity is finished once the device is recorded off', () => {
        const activity = { since: 1787856037 };
        const statuses = [
            { mode: modes.OFF.val, since: 1787856041 },
            { mode: modes.ON.val, since: 1787856037 }
        ];
        expect(statusHelper.isScheduledActivityRunning(activity, statuses, nowMillis)).to.equal(false);
    });

    it('an off recorded before the activity started does not end it', () => {
        const activity = { since: now - 600 };
        const statuses = [{ mode: modes.OFF.val, since: now - 900 }];
        expect(statusHelper.isScheduledActivityRunning(activity, statuses, nowMillis)).to.equal(true);
    });
});

describe('describeRunEnd', function () {

    it('no status describes nothing', function () {
        expect(statusHelper.describeRunEnd(null)).to.equal(null);
    });

    it('a status with no reason describes nothing', function () {
        expect(statusHelper.describeRunEnd({ mode: modes.OFF.val, since: 1000 })).to.equal(null);
    });

    it('reports the temperature a target-reached run got to', function () {
        const ended = { endReason: endReasons.TARGET_REACHED, endTemperature: 45.23 };

        expect(statusHelper.describeRunEnd(ended)).to.equal('reached target at 45.2\u00b0C');
    });

    it('reports a timeout without a temperature', function () {
        expect(statusHelper.describeRunEnd({ endReason: endReasons.TIMED_OUT })).to.equal('timed out');
    });

    it('reports a run that served its full duration', function () {
        expect(statusHelper.describeRunEnd({ endReason: endReasons.DURATION_ELAPSED }))
            .to.equal('ran its duration');
    });

    it('reports a run someone turned off', function () {
        expect(statusHelper.describeRunEnd({ endReason: endReasons.STOPPED_MANUALLY }))
            .to.equal('stopped manually');
    });

    it('falls back to the raw reason when it has no label', function () {
        expect(statusHelper.describeRunEnd({ endReason: 'element_thermostat_cutout' }))
            .to.equal('element_thermostat_cutout');
    });
});
