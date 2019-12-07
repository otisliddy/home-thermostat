import React, { Component } from 'react';
import { modes } from 'home-thermostat-common';
import { toFormattedDate } from '../util/time-helper';

const days = [1, 2, 3, 4, 7, 14, 30];
const options = []
days.forEach(day => options.push(
    <option key={day} value={day}>{day}</option>
));

class RecentActivity extends Component {
    constructor(props) {
        super(props);
        this.state = { days: 1 }
    }

    handleChange(event) {
        this.setState({ days: event.target.value });
    }

    render() {
        const rows = [];

        const sinceDaysAgo = new Date();
        sinceDaysAgo.setTime(sinceDaysAgo.getTime() - this.state.days * 3600 * 24 * 1000);

        if (this.props.statuses) {
            for (let i = 0; i < this.props.statuses.length; i++) {
                const status = this.props.statuses[i];
                if (status.mode !== modes.OFF.val) {
                    const nextStatus = i > 0 ? this.props.statuses[i - 1] : null;
                    this.addStatusRow(status, nextStatus, rows);
                }
                if (status.since < sinceDaysAgo) {
                    break;
                }
            }

        }

        return (
            <div id='activity'>
                <span>Activity last &nbsp;</span>
                <select id='activity-dropdown' onChange={this.handleChange.bind(this)} value={this.state.days}>
                    {options}
                </select>
                <span>&nbsp; days</span>
                <table id='activity-table' >
                    <tbody>{rows}</tbody>
                </table>
            </div>
        )
    }

    addStatusRow(status, nextStatus, rows) {
        let until = '';
        if (nextStatus) {
            until = toFormattedDate(nextStatus.since);
        } else if (status.until) {
            until = toFormattedDate(status.until);
        } else {
            until = 'now'
        }

        let mode = status.mode;
        if (status.fixedTemp) {
            mode += ` at ${status.fixedTemp}°`;
        }
        rows.push(<tr key={status.since}>
            <td>{toFormattedDate(status.since)} - {until}</td><td /><td id='activity-mode'>{mode}</td>
        </tr>);
    }
}

export default RecentActivity;
