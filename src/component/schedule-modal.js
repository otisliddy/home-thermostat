import React, { Component } from 'react';
import { modes } from 'home-thermostat-common';

class ScheduleModal extends Component {
    constructor(props) {
        super(props);
        this.time = React.createRef();
        this.duration = React.createRef();
    }

    handleConfirm() {
        if (!this.time.current.value) {
            return alert('Specify a Start Time');
        }
        if (!this.duration.current.value) {
            return alert('Specify a Duration');
        }
        this.props.handleConfirm(
            this.time.current.value,
            this.duration.current.value
        );
    };

    render() {
        if (!this.props.show) {
            return null;
        }

        return (
            <div id='schedule-modal'>
                <div>
                    <div>
                        <label className='schedule-modal-mode'>
                            <input type='radio' name='mode' value={modes.ON.val}
                                checked={modes.ON.val === this.props.mode.val}
                                onChange={this.props.handleModeChange} />
                            <span className='schedule-modal-label'>{modes.ON.val}</span>
                        </label>
                    </div>
                    <table>
                        <tbody>
                            <tr>
                                <td className='schedule-modal-label'>Start Time:</td>
                                <td>
                                    <input ref={this.time} type='time' step='300' defaultValue='16:00' />
                                </td>
                            </tr>
                            <tr>
                                <td className='schedule-modal-label'>Duration:</td>
                                <td>
                                    <input ref={this.duration} type='time' step='300' defaultValue='01:00' />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div id='schedule-modal-buttons'>
                        <button onClick={() => this.props.handleCancel()}>Cancel</button>
                        <button onClick={() => this.handleConfirm()}>Confirm</button>
                    </div>
                </div>
            </div>
        );
    };
}

export default ScheduleModal;
