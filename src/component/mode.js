import React, { Component } from 'react';

class Mode extends Component {
    constructor(props) {
        super(props);
        this.state = { showItems: false }
    }

    handleChange(value) {
        this.props.onChange(value);
    }

    render() {
        const btnOnClick = this.props.options.length > 0 ? () => { } : () => this.handleChange();
        const modeClass = this.props.mode === this.props.currentMode ? 'mode-dropdown mode-selected' : 'mode-dropdown mode-unselected';
        const optionRows = [];
        this.props.options.forEach(option => {
            optionRows.push(
                <div onClick={() => { this.handleChange(option.value) }}>{option.label}</div>
            )
        })

        return (
            <div onClick={btnOnClick} class={modeClass}>
                <button>
                    {this.props.mode}
                </button>
                <div className='mode-content'>
                    {optionRows}
                </div>
            </div>
        );
    }
}

export default Mode;