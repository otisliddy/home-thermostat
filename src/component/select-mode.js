import React, { Component } from 'react';
import Mode from './mode';
import { modes } from 'home-thermostat-common';

const durationOptions = [
    { label: 'Schedule...', value: 'schedule' },
    { label: '0:15', value: 15 * 60 },
    { label: '0:30', value: 30 * 60 },
    { label: '0:45', value: 45 * 60 },
    { label: '1:00', value: 60 * 60 },
    { label: '1:15', value: 75 * 60 },
    { label: '1:30', value: 90 * 60 },
    { label: '1:45', value: 105 * 60 },
    { label: '2:00', value: 2 * 60 * 60 },
    { label: '3:00', value: 3 * 60 * 60 },
    { label: '4:00', value: 4 * 60 * 60 }
];

const tempOptions = [
    { label: 'Schedule...', value: 'schedule' }
];
for (var i = 10; i < 25; i++) {
    tempOptions.push({ label: i, value: i });
}

class SelectMode extends Component {
    render() {
        const disabled = !/^(Off|On|Fixed Temp)$/.test(this.props.currentMode);
        return (
            <div id='select-mode'>
                {/* <Mode mode={modes.PROFILE.val} currentMode={this.props.currentMode} disabled={disabled} options={[]}
                    onChange={this.props.handleProfile} /> */}
                <Mode mode={modes.FIXED_TEMP.val} currentMode={this.props.currentMode} options={tempOptions} disabled={disabled}
                    onChange={this.props.handleFixedTemp} />
                <Mode mode={modes.ON.val} currentMode={this.props.currentMode} options={durationOptions} disabled={disabled}
                    onChange={this.props.handleOn} />
                <Mode mode={modes.OFF.val} currentMode={this.props.currentMode} options={[]} disabled={disabled}
                    onChange={this.props.handleOff} />
            </div>
        );
    }
}

export default SelectMode;
