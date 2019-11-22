import React, { Component } from 'react';
import Select from 'react-dropdown-select';
import AWS from 'aws-sdk';


/*TODO: - convert components to functional components
- convert text modes to images
- create state machine through amplify
- create enum for modes
- auto-fill durationOptions
*/
const weatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather?q=Barna,ie&appid=7844d2a2a82bb813b21942e3c97eb67a';
const thingSpeakTempUrl = 'https://api.thingspeak.com/channels/879596/fields/1/last.json';
const thingSpeakModeUrl = 'https://api.thingspeak.com/channels/879596/fields/2/last.json';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/channels/879596/fields/3/last.json';
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';

// Have to use a proxyLambda because can't invoke StepFunctions directly: https://forums.aws.amazon.com/thread.jspa?threadID=248225
const initiateWorkflowLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:initiate-home-thermostat-state-machine-test';
const identityPoolId = 'eu-west-1:12319816-c5b9-4593-8dae-129cfab87abf';
AWS.config.region = 'eu-west-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: identityPoolId,
});
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

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

class TempDisplay extends Component {
  constructor(props) {
    super(props);
    this.state = ({ tempInside: 'Loading...' });
  }

  componentDidMount() {
    fetch(weatherApiUrl).then(res => res.json()).then((data) => {
      const tempCelsius = Math.round((data.main.temp - 273.15) * 2) / 2;
      this.setState({ tempOutside: tempCelsius });
    });
    thingSpeak(thingSpeakTempUrl, (res) => {
      const tempRounded = Math.round(res.field1 * 10) / 10;
      this.setState({ tempInside: tempRounded });
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
      if (mode === 'Fixed Temp') {
        console.log('otis');
        thingSpeak(thingSpeakControlTempUrl, (res) => {
          console.log(res.field3);
          this.setState({ status: { mode: mode, fixedTemp: res.field3 } });
        })
      }
    });
  }

  handleSchedule() {
    this.setState({ status: { mode: 'Schedule' } });
  }

  handleFixedTemp(selectedTemp) {
    console.log('Changing to fixed temp');
    const temp = selectedTemp[0].value;
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "0", "action": "2", "temp": "${temp}"}` //TODO use json.stringify
    };

    this.setState({ status: { mode: 'Setting fixed temp...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        this.setState({ status: { mode: 'Fixed Temp' , fixedTemp: temp} });
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  handleOn(selectedDuration) {
    console.log('Turning on');
    const timeSeconds = selectedDuration[0].value;
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "${timeSeconds}", "action": "0"}` //TODO use json.stringify
    };

    this.setState({ status: { mode: 'Turning on...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        const since = new Date();
        const until = new Date(since.getTime());
        until.setSeconds(until.getSeconds() + timeSeconds);
        thingSpeak(thingSpeakModeWriteUrl + '1', () => this.setState({
          status: {
            mode: 'On',
            since: since,
            until: until
          }
        }));
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  handleOff() {
    console.log('Turning off');
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "0", "action": "0"}` //TODO use json.stringify
    };

    this.setState({ status: { mode: 'Turning off...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        this.setState({ status: { mode: 'Off' } });
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  render() {
    //<Status status={this.state.status} />
    return (
      <div>
        <TempDisplay />
        <SelectMode currentMode={this.state.status.mode}
          handleOn={this.handleOn.bind(this)}
          handleOff={this.handleOff.bind(this)}
          handleFixedTemp={this.handleFixedTemp.bind(this)}
          handleSchedule={this.handleSchedule.bind(this)} />
      </div>
    );
  }
}

/*
###################### Global functions ###################### 
*/
function thingSpeak(url, callback) {
  fetchRetry(url, callback, 60);
}

function fetchRetry(url, callback, n) {
  return new Promise(function (resolve, reject) {
    fetch(url).then(res => res.json()).then(async (data) => {
      if (data !== 0) {
        callback(data);
        resolve(data);
      } else {
        if (n === 1) return reject('Max retries reached');
        await sleep(1000);
        fetchRetry(url, callback, n - 1);
      }
    }).catch(function (error) {
      reject(error)
    })
  });
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export default App;
