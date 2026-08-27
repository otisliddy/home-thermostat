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

    // If data is stale (older than 10 minutes), show when it was read. The day is part of it,
    // otherwise a reading from days ago is indistinguishable from one taken this morning.
    if (dhwTemperature.isStale) {
      const date = new Date(dhwTemperature.timestamp);
      const reading = date.toLocaleString([], {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${tempDisplay} (${reading})`;
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
        <span className={`temp-value ${dhwTemperature?.isStale ? 'stale' : ''}`}>{formatDhwDisplay()}</span>
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
