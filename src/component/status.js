import React, { Component } from 'react';
import { modes } from 'home-thermostat-common';
import { toFormattedDate, generateTimeDiffText } from '../util/time-helper';

class Status extends Component {
  render() {
    let mode = this.props.status.mode;
    let since = '';

    Object.keys(modes).forEach((key) => {
      if (modes[key].val === this.props.status.mode && this.props.status.since) {
        since += `since ${toFormattedDate(this.props.status.since)}`;
        since += ` (${generateTimeDiffText(this.props.status.since)})`;
        if (this.props.status.until) {
          since += ` until ${toFormattedDate(this.props.status.until)}`;
          since += ` (${generateTimeDiffText(this.props.status.until)})`;
        }
      };
    });

    const connectedText = this.props.connected ? "Heating Connected" : "Heating not connected";

    return (
      <div className='status'>
        <div className='mode'>Status: {mode}</div>
        <div className='since'>{since}</div>
        <div className={`connected-${this.props.connected}`}>{connectedText}</div>
      </div>
    );
  }
}

export default Status;
