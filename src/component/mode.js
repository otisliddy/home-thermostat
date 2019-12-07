import React, { Component } from 'react';

class Mode extends Component {
    constructor(props) {
        super(props);
        this.state = { showItems: false }
    }

    handleChange(value) {
        this.showItems(false);
        this.props.onChange(value);
    }

    handleButtonClick(value) {
        if (this.props.options.length > 0) {
            this.showItems(true);
        } else {
            this.props.onChange(value);
        }
    }

    showItems(flag) {
        return () => this.setState({ showItems: flag });
    }

    render() {
        let modeClass = 'mode-dropdown';
        modeClass += this.props.mode === this.props.currentMode ? ' mode-selected' : ' mode-unselected';
        modeClass += this.props.options.length === 0 ? ' mode-no-items' : '';

        const displayContent = this.state.showItems ? { display: 'block' } : { display: 'none' };
        const optionRows = [];
        this.props.options.forEach(option => {
            optionRows.push(
                <div key={option.label} onClick={() => { this.handleChange(option.value) }}>{option.label}</div>
            )
        })

        return (
            <div onClick={this.handleButtonClick.bind(this)}
                onMouseOver={this.showItems(true)}
                onMouseLeave={this.showItems(false)}
                className={modeClass}>
                <button >
                    {this.props.mode}
                </button>
                <div className='mode-content' onClick={this.showItems(false)} style={displayContent}>
                    {optionRows}
                </div>
            </div>
        );
    }
}

export default Mode;