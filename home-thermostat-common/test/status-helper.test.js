const expect = require('chai').expect;
const statusHelper = require('../src/util/status-helper');
const modes = require('../src/constants/modes');

it('should create a status from off mode', function () {
    const status = statusHelper.createStatus(modes.OFF);
    expect(status).to.have.property('since');
    expect(status).not.to.have.property('until');
    expect(status).not.to.have.property('fixedTemp');
    expect(status).not.to.have.property('schedule');
});

it('should create a status from on mode', function () {
    const status = statusHelper.createStatus(modes.ON, {duration: 900});
    expect(status).to.have.property('since');
    expect(status).to.have.property('until');
    expect(status).not.to.have.property('fixedTemp');
    expect(status).not.to.have.property('schedule');
});

it('should create a status from fixed temp mode', function () {
    const status = statusHelper.createStatus(modes.FIXED_TEMP, {fixedTemp: 12});
    expect(status).to.have.property('since');
    expect(status).not.to.have.property('until');
    expect(status).to.have.property('fixedTemp');
    expect(status.fixedTemp).to.be.equal(12);
    expect(status).not.to.have.property('schedule');
});
