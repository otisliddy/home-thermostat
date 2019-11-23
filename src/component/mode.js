import React, { Component } from 'react';
import Select from 'react-dropdown-select';

class Mode extends Component {
    constructor(props) {
        super(props);
        this.state = { mode: this.props.mode }
        this._child = React.createRef(); // need to create ref to get a hold on the Select's clearAll() method
    }

    // Once a value has been selected and onChange called, reset the dropdown so it displays the mode again
    handleChange(value) {
        if (value && value.length > 0) {
            this.props.onChange(value);
            this._child.current.clearAll();
        }
    }

    render() {
        const modeClass = this.props.mode === this.props.currentMode ? 'modeSelected' : 'modeUnselected';
        return (
            <Select className={modeClass} ref={this._child}
                options={this.props.options} values={[]} color={'pink'}
                dropdownHandle={false} searchable={false} placeholder={this.props.mode} disabled={this.props.disabled}
                onChange={(value) => { this.handleChange(value) }}
            />
        );
    }
}

export default Mode;