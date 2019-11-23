import React, { Component } from 'react';
import Mode from './mode';

const durationOptions = [
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
const tempOptions = [];
for (var i = 10; i < 25; i++) {
    tempOptions.push({ label: i, value: i });
}

class SelectMode extends Component {
    render() {
        const disabled = !/^(Off|On|Fixed Temp)$/.test(this.props.currentMode);
        const offBtnClass = 'Off' === this.props.currentMode ? 'modeSelected' : 'modeUnselected';
        return (
            <div className='selectMode'>
                <Mode mode='Schedule' currentMode={this.props.currentMode} disabled={disabled}
                    onChange={this.props.handleSchedule} />
                <Mode mode='Fixed Temp' currentMode={this.props.currentMode} options={tempOptions} disabled={disabled}
                    onChange={this.props.handleFixedTemp} />
                <Mode mode='On' currentMode={this.props.currentMode} options={durationOptions} disabled={disabled}
                    onChange={this.props.handleOn} />
                <button className={offBtnClass} onClick={this.props.handleOff} disabled={disabled}>Off</button>
            </div>
        );
    }
}

export default SelectMode;
