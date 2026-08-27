function hoursMinsToSecondsFromNow(hoursMins) {
  const date = hoursMinsToDate(hoursMins);
  let secondsFromNow = (date.getTime() - new Date().getTime()) / 1000;

  return Math.round(secondsFromNow);
}

function hoursMinsToDate(hoursMins) {
  const startHour = parseInt(hoursMins.split(':')[0], 10);
  const startMinute = parseInt(hoursMins.split(':')[1], 10);
  const date = new Date();
  date.setHours(startHour, startMinute, 0, 0);
  if (date.getTime() < new Date().getTime()) {
    date.setTime(date.getTime() + 1000 * 3600 * 24);
  }

  return date;
}

function hoursMinsToISOString(hoursMins) {
  // Convert HH:MM to ISO string with timezone
  const date = hoursMinsToDate(hoursMins);
  return date.toISOString();
}

function relativeDateAgo(daysAgo) {
  const date = new Date();
  date.setTime(date.getTime() - daysAgo * 3600 * 24 * 1000);

  return Math.ceil(date.getTime() / 1000);
}

function generateTimeDiffText(dateSeconds) {
  let diffText = '';
  let leadingSpace = '';
  const date = new Date(dateSeconds * 1000);
  let secondsDiff = Math.round(Math.abs((new Date().getTime() - date.getTime()) / 1000));
  if (secondsDiff >= 3600 * 24) {
    const days = Math.floor(secondsDiff / (3600 * 24));
    secondsDiff -= days * 3600 * 24;
    leadingSpace = ' ';
    diffText += days === 1 ? `${days} day` : `${days} days`;
  }
  if (secondsDiff >= 3600) {
    const hours = Math.floor(secondsDiff / (3600));
    secondsDiff -= hours * 3600;
    diffText += leadingSpace;
    leadingSpace = ' ';
    diffText += hours === 1 ? `${hours} hour` : `${hours} hours`;
  }
  if (secondsDiff >= 60) {
    const mins = Math.floor(secondsDiff / (60));
    diffText += leadingSpace;
    diffText += mins === 1 ? `${mins} minute` : `${mins} minutes`;
  }
  if (diffText === '') {
    diffText = 'less than one minute';
  }
  if (date < new Date()) {
    diffText += ' ago';
  }
  return diffText;
}

export {
  hoursMinsToSecondsFromNow,
  hoursMinsToDate,
  hoursMinsToISOString,
  relativeDateAgo,
  generateTimeDiffText
}
