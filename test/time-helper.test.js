import timeHelper from '../src/util/time-helper';
const expect = require('chai').expect;

it('should create correct diff text from less than one minute', function () {
    const date = new Date();
    date.setTime(date.getTime - 1000);
    const result = timeHelper.generateTimeDiffText(date)
    expect(result).to.be.equal('less than one minute ago');
});