import React, { Component } from 'react';
import { toFormattedDate } from '../util/time-helper';

class ScheduledActivity extends Component {

    addStatusRow(status, rows) {
        let until = toFormattedDate(status.until);

        let mode = status.mode;
        if (status.temp) {
            mode += ` at ${status.temp}°`;
        }
        rows.push(<tr key={status.since}>
            <td>{toFormattedDate(status.since)} - {until}</td><td /><td className='activity-mode'>{mode}</td>
        </tr>);
    }

    render() {
        const rows = [];

        const now = new Date().getTime();
        if (this.props.statuses) {
            for (let i = 0; i < this.props.statuses.length; i++) {
                const status = this.props.statuses[i];
                if (status.since > now) {
                    this.addStatusRow(status, rows);
                }
            }
        }
        if (rows.length === 0) {
            rows.push(<tr key='empty'>
                <td>-</td><td /><td className='activity-mode'>-</td>
            </tr>);
        }

        return (
            <div className='activity'>
                <span>Scheduled Activity</span>
                <table className='activity-table' >
                    <tbody>{rows}</tbody>
                </table>
            </div>
        )
    }
}
//<button id='activity-cancel' onClick={this.props.handleCancelAll}>Cancel All</button>

export default ScheduledActivity;
