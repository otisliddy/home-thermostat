import React, { Component } from 'react';

class ScheduleModal extends Component {

    constructor(props) {
        super(props);
        this.time = React.createRef();
        this.duration = React.createRef();
    }

    handleConfirm() {
        this.props.handleConfirm(this.time.current.value, this.duration.current.value);
    };

    render() {
        if (!this.props.show) {
            return null;
        }

        return (
            <div id='schedule-modal'>
                <div>
                    <table>
                        <tbody>
                            <tr className='schedule-modal-time'>
                                <td>Time:</td>
                                <td>
                                    <input ref={this.time} type='time' step='300' defaultValue='18:00'/>
                                </td>
                            </tr>
                            <tr className='schedule-modal-time'>
                                <td>Duration:</td>
                                <td>
                                    <input ref={this.duration} type='time' step='300' defaultValue='01:00'/>
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
