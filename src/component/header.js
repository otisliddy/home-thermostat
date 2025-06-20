import React, { Component } from 'react';
import ConnectedIcon from '../images/connected-svgrepo-com.svg';
import DisconnectedIcon from '../images/disconnected-svgrepo-com.svg';

const weatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather?lat=52.9807857&lon=-6.046806&appid=5796abbde9106b7da4febfae8c44c232';

class Header extends Component {
  constructor(props) {
    super(props);
    this.state = ({});
  }

  componentDidMount() {
    fetch(weatherApiUrl).then(res => res.json()).then((data) => {
      const tempCelsius = Math.round((data.main.temp - 273.15) * 2) / 2;
      this.setState({ tempOutside: tempCelsius });
    });
  }

  render() {
    return (
      <div id='header'>
      <div id='connected-status' hidden={this.props.connected === undefined}>
        <img src={this.props.connected? ConnectedIcon: DisconnectedIcon} alt='Icon not found'/>
      </div>
        <div id='temp-outside'>{this.state.tempOutside}<sup>&#8451;</sup> Outside</div>
      </div>
    );
  }
}

export default Header;
