import React, { Component } from 'react';
import modes from '../constants/constants';
import dateformat from 'dateformat';

class Status extends Component {
  render() {
    let status = this.props.status.mode;

    Object.keys(modes).forEach((mode) => {
      if (modes[mode].val === this.props.status.mode) {
        status += ` since ${toFormattedDate(this.props.status.since)}`;
        status += ` (${generateAgoString(this.props.status.since)} ago)`;
      };
    });

    switch (this.props.status.mode) {
      case (modes.FIXED_TEMP.val):
        break;
      default:
    }

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 8);

    return (
      <div className='status'>Status: {status}</div>
    );
  }
}

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

function generateAgoString(dateMillis) {
  let agoString = '';
  let leadingSpace = '';
  const date = new Date(dateMillis);
  let secondsAgo = (new Date().getTime() - date.getTime()) / 1000;
  if (secondsAgo > 3600 * 24) {
    const days = Math.floor(secondsAgo / (3600 * 24));
    secondsAgo -= days * 3600 * 24;
    leadingSpace = ' ';
    agoString += days === 1 ? `${days} day` : `${days} days`;
  }
  if (secondsAgo > 3600) {
    const hours = Math.floor(secondsAgo / (3600));
    secondsAgo -= hours * 3600;
    agoString += leadingSpace;
    leadingSpace = ' ';
    agoString += hours === 1 ? `${hours} hour` : `${hours} hours`;
  }
  if (secondsAgo > 60) {
    const mins = Math.floor(secondsAgo / (60));
    secondsAgo -= mins * 60;
    agoString += leadingSpace;
    agoString += mins === 1 ? `${mins} minute` : `${mins} minutes`;
  }
  if (agoString === '') {
    agoString = 'less than one minute';
  }
  return agoString;
}

export default Status;
