import dateformat from 'dateformat';

function toFormattedDate(dateMillis) {
    const date = new Date(dateMillis);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    if (date < oneDayAgo) {
      return dateformat(date, "dd mmm HH:MM");
    } else {
      return dateformat(date, "HH:MM");
    }
  }
  
  function generateTimeDiffText(dateMillis) {
    let diffText = '';
    let leadingSpace = '';
    const date = new Date(dateMillis);
    let secondsDiff = Math.abs((new Date().getTime() - date.getTime()) / 1000);
    if (secondsDiff > 3600 * 24) {
      const days = Math.floor(secondsDiff / (3600 * 24));
      secondsDiff -= days * 3600 * 24;
      leadingSpace = ' ';
      diffText += days === 1 ? `${days} day` : `${days} days`;
    }
    if (secondsDiff > 3600) {
      const hours = Math.floor(secondsDiff / (3600));
      secondsDiff -= hours * 3600;
      diffText += leadingSpace;
      leadingSpace = ' ';
      diffText += hours === 1 ? `${hours} hour` : `${hours} hours`;
    }
    if (secondsDiff > 60) {
      const mins = Math.floor(secondsDiff / (60));
      secondsDiff -= mins * 60;
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
    toFormattedDate,
    generateTimeDiffText
}
