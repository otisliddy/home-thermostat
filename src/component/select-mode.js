import React, { Component } from 'react';
import Mode from './mode';
import { modes } from 'home-thermostat-common';

const durationOptions = [
    { label: 'Schedule...', value: 'schedule' },
    { label: '0:10', value: 10 * 60 },
    { label: '0:15', value: 15 * 60 },
    { label: '0:20', value: 20 * 60 },
    { label: '0:30', value: 30 * 60 },
    { label: '0:40', value: 40 * 60 },
    { label: '0:50', value: 50 * 60 },
    { label: '1:00', value: 60 * 60 },
    { label: '1:30', value: 90 * 60 },
    { label: '2:00', value: 2 * 60 * 60 }
];

class SelectMode extends Component {
    render() {
        const disabled = !/^(Off|On)$/.test(this.props.currentMode);
        return (
            <div id='select-mode'>
                {/* <Mode mode={modes.PROFILE.val} currentMode={this.props.currentMode} disabled={disabled} options={[]}
                    onChange={this.props.handleProfile} /> */}
                <Mode mode={modes.ON.val} currentMode={this.props.currentMode} options={durationOptions} disabled={disabled}
                    onChange={this.props.handleOn} />
                <Mode mode={modes.OFF.val} currentMode={this.props.currentMode} options={[]} disabled={disabled}
                    onChange={this.props.handleOff} />
            </div>
        );
    }
}

export default SelectMode;
