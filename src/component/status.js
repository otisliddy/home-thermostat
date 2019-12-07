import React, { Component } from 'react';
import { modes } from 'home-thermostat-common';
import { toFormattedDate, generateTimeDiffText } from '../util/time-helper';

class Status extends Component {
  render() {
    let mode = this.props.status.mode;
    let since = '';

    Object.keys(modes).forEach((mode) => {
      if (modes[mode].val === this.props.status.mode && this.props.status.since) {
        if (this.props.status.temp) {
          mode += ` at ${this.props.status.temp}°`;
        }
        since += `since ${toFormattedDate(this.props.status.since)}`;
        since += ` (${generateTimeDiffText(this.props.status.since)})`;
        if (this.props.status.until) {
          since += ` until ${toFormattedDate(this.props.status.until)}`;
          since += ` (${generateTimeDiffText(this.props.status.until)})`;
        }
      };
    });

    return (
      <div className='status'>
        <div className='mode'>Status: {mode}</div>
        <div className='since'>{since}</div>
      </div>
    );
  }
}

export default Status;
