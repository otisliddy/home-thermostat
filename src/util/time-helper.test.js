import { generateTimeDiffText, hoursMinsToDate } from './time-helper';

describe('generateTimeDiffText', () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it('should create correct diff text from less than one minute', () => {
    expect(generateTimeDiffText(nowSeconds() - 1)).toEqual('less than one minute ago');
  });

  it('should create correct diff text from minutes', () => {
    expect(generateTimeDiffText(nowSeconds() - 5 * 60)).toEqual('5 minutes ago');
  });

  it('should create correct diff text from hours and minutes', () => {
    expect(generateTimeDiffText(nowSeconds() - (2 * 3600 + 30 * 60))).toEqual('2 hours 30 minutes ago');
  });

  it('should create correct diff text for the future', () => {
    expect(generateTimeDiffText(Date.now() / 1000 + 90 * 60)).toEqual('1 hour 30 minutes');
  });
});

describe('hoursMinsToDate', () => {
  it('should clear seconds and milliseconds', () => {
    const date = hoursMinsToDate('07:40');

    expect(date.getHours()).toEqual(7);
    expect(date.getMinutes()).toEqual(40);
    expect(date.getSeconds()).toEqual(0);
    expect(date.getMilliseconds()).toEqual(0);
  });

  it('should roll forward to tomorrow when the time has passed', () => {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const hoursMins = `${String(oneHourAgo.getHours()).padStart(2, '0')}:${String(oneHourAgo.getMinutes()).padStart(2, '0')}`;

    expect(hoursMinsToDate(hoursMins).getTime()).toBeGreaterThan(Date.now());
  });
});
