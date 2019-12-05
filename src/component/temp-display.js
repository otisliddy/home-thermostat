import React, { Component } from 'react';
import thingSpeak from '../rest/rest-handler';

const weatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather?q=Barna,ie&appid=7844d2a2a82bb813b21942e3c97eb67a';
const thingSpeakTempUrl = 'https://api.thingspeak.com/channels/879596/fields/1/last.json';

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
          <div className='tempInside'>{this.state.tempInside}<sup>&#8451;</sup></div>
          <div className='tempOutside'>{this.state.tempOutside}<sup>&#8451;</sup> Outside</div>
        </div>
      );
    }
}
  
export default TempDisplay;
