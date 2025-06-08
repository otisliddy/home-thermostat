import React, { Component } from 'react';
import { toFormattedDate } from '../util/time-helper';

class ScheduledActivity extends Component {

    addStatusRow(status, rows) {
        let until = toFormattedDate(status.until);

        rows.push(<tr key={status.since}>
            <td>{toFormattedDate(status.since)} - {until}</td><td />
            <td className='activity-mode'>{status.mode}</td><td />
            <td><svg className="delete-icon" onClick={() => this.props.handleDelete(status)} value={status} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg></td>
        </tr>);
    }

    render() {
        const rows = [];

        const now = new Date().getTime() / 1000;
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

export default ScheduledActivity;
