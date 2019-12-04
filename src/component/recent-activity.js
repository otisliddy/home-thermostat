import React, { Component } from 'react';
import dateformat from 'dateformat';

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
            for (let i = 0; i < this.props.statuses.length - 1; i++) {
                const status = this.props.statuses[i];
                this.addStatusRow(status, rows);
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

    addStatusRow(status, rows) {
        let until = '';
        if (status.until) {
            until = ' to ' + toFormattedDate(status.until);
        }
        let mode = status.mode;
        if (status.fixedTemp) {
            mode += ` at ${status.fixedTemp}°`;
        }
        rows.push(<tr>
            <td>{toFormattedDate(status.since)}{until}</td><td /><td>{mode}</td>
        </tr>);
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

export default RecentActivity;
