import React from 'react';
import './header.css';

const Header = ({ connected, outsideTemp, dhwTemperature, onDhwClick }) => {
  const formatTemp = (temp) => {
    if (temp === null || temp === undefined) return '--';
    return temp.toFixed(1);
  };

  const formatDhwDisplay = () => {
    if (!dhwTemperature) return 'DHW: --°C';

    const tempDisplay = `DHW: ${dhwTemperature.temperature.toFixed(1)}°C`;

    // If data is stale (older than 10 minutes), show it differently
    if (dhwTemperature.isStale) {
      const date = new Date(dhwTemperature.timestamp);
      return `${tempDisplay} (${date.toLocaleTimeString()})`;
    }

    return tempDisplay;
  };

  return (
    <div className="header">
      <div className="header-item connection-status">
        <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
        <span className="status-text">{connected ? 'Connected' : 'Offline'}</span>
      </div>

      <div className="header-item outside-temp">
        <span className="temp-label">Outside:</span>
        <span className="temp-value">{formatTemp(outsideTemp)}°C</span>
      </div>

      <div
        className="header-item dhw-temp clickable"
        onClick={onDhwClick}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === 'Enter' && onDhwClick()}
      >
        <span className="temp-value">{formatDhwDisplay()}</span>
        <svg
          className="expand-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>
    </div>
  );
};

export default Header;
