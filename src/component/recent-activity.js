import React, { Component } from 'react';
import { modes } from 'home-thermostat-common';
import { toFormattedDate } from '../utils/time-helper';

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

        console.log(this.props.statuses);

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
            <div>
                <label>Activity last &nbsp;</label>
                <select className='activityDropdown' onChange={this.handleChange.bind(this)} value={this.state.days}>
                    <option value='1'>1</option>
                    <option value='2'>2</option>
                    <option value='3'>3</option>
                    <option value='4'>4</option>
                    <option value='7'>7</option>
                    <option value='14'>14</option>
                    <option value='30'>30</option>
                </select>
                <label>&nbsp; days</label>
                <table className='activityTable' >
                    <tbody>{rows}</tbody>
                </table>
            </div>
        )
    }

    addStatusRow(status, nextStatus, rows) {
        let until = '';
        if (status.until && (!nextStatus || status.until < nextStatus.since)) {
            until = toFormattedDate(status.until);
        } else {
            until = toFormattedDate(nextStatus.since);
        }

        let mode = status.mode;
        if (status.fixedTemp) {
            mode += ` at ${status.fixedTemp}°`;
        }
        rows.push(<tr>
            <td>{toFormattedDate(status.since)} - {until}</td><td /><td className='activityMode'>{mode}</td>
        </tr>);
    }
}

export default RecentActivity;
