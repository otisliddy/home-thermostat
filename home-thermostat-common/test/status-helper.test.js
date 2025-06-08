const expect = require('chai').expect;
const statusHelper = require('../src/util/status-helper');
const { modes } = require('../src/constants/modes');

it('should create a status from off mode', function () {
    const status = statusHelper.createStatus(modes.OFF.val);
    expect(status).to.have.property('mode');
    expect(status).to.have.property('since');
    expect(status).not.to.have.property('until');
});

it('should create a status from on mode', function () {
    const status = statusHelper.createStatus(modes.ON.val, {duration: 900});
    expect(status).to.have.property('mode');
    expect(status).to.have.property('since');
    expect(status).to.have.property('until');
});

it('should create a status with execution ARN', function () {
    const status = statusHelper.createStatus(modes.ON.val,  {duration: 900, executionArn: '"ARN"' });
    expect(status).to.have.property('mode');
    expect(status).to.have.property('since');
    expect(status).to.have.property('until');
    expect(status).to.have.property('executionArn');
    expect(status.executionArn).to.be.equal('ARN');
});
