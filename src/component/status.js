import React, { Component } from 'react';

class Status extends Component {
    render() {
      let status;
      switch (this.props.status.mode) {
        case ('Fixed Temp'):
          status = `${this.props.status.mode} (${this.props.status.fixedTemp})`;
          break;
        default:
          status = this.props.status.mode;
      }
      return (
        <div className='status'>Status: {status}</div>
      );
    }
}
  
export default Status;
