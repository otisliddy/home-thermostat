import React, { Component } from 'react';
import { toFormattedDate } from '../util/time-helper';

class ScheduledActivity extends Component {

    addStatusRow(status, rows) {
        let until = status.until ? toFormattedDate(status.until) : '';
        const recurringIcon = status.recurring ?
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{verticalAlign: 'middle', marginRight: '5px'}}>
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
            : null;

        rows.push(<tr key={status.since}>
            <td>{recurringIcon}{toFormattedDate(status.since)} - {until}</td><td />
            <td className='activity-mode'>{status.mode}</td><td />
            <td><svg className="delete-icon" onClick={() => this.props.handleDelete(status)} value={status} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg></td>
        </tr>);
    }

    render() {
        const rows = [];

        if (this.props.statuses) {
            for (let i = 0; i < this.props.statuses.length; i++) {
                this.addStatusRow(this.props.statuses[i], rows);
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
