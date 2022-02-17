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

    return (
      <div className='status'>
        <div className='mode'>Status: {mode}</div>
        <div className='since'>{since}</div>
        <div className={`connected-${this.props.connected}`} hidden={this.props.connected === undefined}>
          {this.props.connected ? "Arduino Connected" : "Arduino not connected"}
        </div>
      </div>
    );
  }
}

export default Status;
