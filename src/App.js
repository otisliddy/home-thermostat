import React, { Component } from 'react';

/*TODO: -convert components to functional components
- convert text modes to images
*/
const weatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather?q=Barna,ie&appid=7844d2a2a82bb813b21942e3c97eb67a';
const thingSpeakTempUrl = 'https://api.thingspeak.com/channels/879596/fields/1/last.json';
const thingSpeakModeUrl = 'https://api.thingspeak.com/channels/879596/fields/2/last.json';
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=2&field3=';

class Mode extends Component {
  render() {
    const modeText = this.props.mode === this.props.currentMode ?
      <span style={{ color: '#FFEE58' }}>
        {this.props.mode}
      </span> : this.props.mode;

    return (
      <button className='modeButton' onClick={this.props.onClick}>{modeText}</button>
    );
  }
}

class SelectMode extends Component {
  render() {
    return (
      <table className='selectMode'>
        <tr>
          <td><Mode mode='Schedule' currentMode={this.props.currentMode}
            onClick={this.props.handleSchedule} /></td>
          <td><Mode mode='Fixed Temp' currentMode={this.props.currentMode}
            onClick={this.props.handleFixedTemp} /></td>
          <td><Mode mode='On' currentMode={this.props.currentMode}
            onClick={this.props.handleOn} /></td>
          <td><Mode mode='Off' currentMode={this.props.currentMode}
            onClick={this.props.handleOff} /></td>
        </tr>
      </table>
    );
  }

}

class Status extends Component {
  render() {
    return (
      <div className='status'>Status: {this.props.status.mode}</div>
    );
  }
}

class TempDisplay extends Component {
  constructor(props) {
    super(props);
    this.state = ({ tempInside: 'Loading...' });
  }

  componentDidMount() {
    fetch(weatherApiUrl).then(res => res.json()).then((data) => {
      const tempCelsius = Math.round(data.main.temp - 273.15);
      this.setState({ tempOutside: tempCelsius });
    });
    thingSpeak(thingSpeakTempUrl, (res) => {
      const temp = res.field1;
      this.setState({ tempInside: temp });
    });
  }

  render() {
    return (
      <div className='tempDisplay'>
        <div>Temp Inside: {this.state.tempInside}</div>
        <div>Temp Outside: {this.state.tempOutside}</div>
      </div>
    );
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { status: { mode: 'Loading...' } };
  }

  componentDidMount() {
    thingSpeak(thingSpeakModeUrl, (res) => {
      const fieldVal = res.field2
      const mode = fieldVal === '0' ? 'Off' : fieldVal === '1' ? 'On' : 'Fixed Temp';
      this.setState({ status: { mode: mode } });
    });
  }

  handleSchedule() {
    this.setState({ status: { mode: 'Schedule' } });
  }

  handleFixedTemp() {
    thingSpeak(thingSpeakControlTempUrl + '25', () => this.setState({ status: { mode: 'Fixed Temp' } }))
  }

  handleOn() {
    thingSpeak(thingSpeakModeWriteUrl + '1', () => this.setState({ status: { mode: 'On' } }))
  }

  handleOff() {
    thingSpeak(thingSpeakModeWriteUrl + '0', () => this.setState({ status: { mode: 'Off' } }))
  }

  render() {
    return (
      <div>
        <TempDisplay />
        <Status status={this.state.status} />
        <SelectMode currentMode={this.state.status.mode} handleOn={() => this.handleOn()} handleOff={() => this.handleOff()} handleFixedTemp={() => this.handleFixedTemp()} handleSchedule={() => this.handleSchedule()} />
      </div>
    );
  }
}

//TODO clean up
async function thingSpeak(url, callback) {
  let response = 0;
  for (var i = 0; i < 20; i++) {
    console.log(i);
    fetch(url).then(res => res.json()).then((data) => {
      response = data;
    });
    if (response !== 0) {
      callback(response);
      return;
    } else {
      await sleep(1000);
    }
  }
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const mockData = {
  status: { mode: 'Off', startTime: 1571694202667, durationMins: 60 },
};

export default App;
