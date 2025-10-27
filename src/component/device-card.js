import React, { useState } from 'react';
import './device-card.css';

const DeviceCard = ({
  device,
  deviceName,
  status,
  scheduledActivity,
  onTurnOn,
  onTurnOnToDHW,
  onSchedule,
  onTurnOff,
  onViewStats
}) => {
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showTempPicker, setShowTempPicker] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [targetTemp, setTargetTemp] = useState(41);

  const isCurrentlyOn = status?.device === device && status?.mode === 'On';
  const isLoading = status?.mode === 'Loading...';

  // Calculate time remaining for current status
  const getTimeRemaining = () => {
    if (!isCurrentlyOn || !status.until) return null;

    const untilMs = status.until > 10000000000 ? status.until : status.until * 1000;
    const now = Date.now();
    const remainingMs = untilMs - now;

    if (remainingMs <= 0) return 'ending soon';

    const minutes = Math.floor(remainingMs / 60000);
    if (minutes < 60) return `${minutes}m left`;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
  };

  // Get next scheduled activity for this device
  const getNextScheduled = () => {
    if (!scheduledActivity || scheduledActivity.length === 0) return null;

    const deviceScheduled = scheduledActivity
      .filter(activity => activity.device === device)
      .sort((a, b) => a.since - b.since);

    if (deviceScheduled.length === 0) return null;

    const next = deviceScheduled[0];
    const sinceMs = next.since > 10000000000 ? next.since : next.since * 1000;
    const date = new Date(sinceMs);
    const today = new Date();

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === new Date(today.getTime() + 86400000).toDateString();

    let dateStr;
    if (isToday) dateStr = 'Today';
    else if (isTomorrow) dateStr = 'Tomorrow';
    else dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `${dateStr} ${timeStr}`;
  };

  const handleTurnOnClick = () => {
    setShowDurationPicker(!showDurationPicker);
    setShowTempPicker(false);
  };

  const handleTurnOnToDHWClick = () => {
    setShowTempPicker(!showTempPicker);
    setShowDurationPicker(false);
  };

  const handleDurationConfirm = () => {
    const durationSeconds = durationMinutes * 60;
    onTurnOn(durationSeconds);
    setShowDurationPicker(false);
  };

  const handleTempConfirm = () => {
    onTurnOnToDHW(targetTemp);
    setShowTempPicker(false);
  };

  const nextScheduled = getNextScheduled();
  const timeRemaining = getTimeRemaining();

  return (
    <div className={`device-card ${isCurrentlyOn ? 'active' : ''}`}>
      <div className="device-card-header">
        <h3 className="device-name">{deviceName}</h3>
        <div className="header-right">
          <div className="device-status">
            {isLoading ? (
              <span className="status-text loading">Loading...</span>
            ) : isCurrentlyOn ? (
              <>
                <span className="status-indicator on"></span>
                <span className="status-text on">ON</span>
                {timeRemaining && <span className="time-remaining">• {timeRemaining}</span>}
              </>
            ) : (
              <>
                <span className="status-indicator off"></span>
                <span className="status-text off">OFF</span>
              </>
            )}
          </div>
          {isCurrentlyOn && (
            <button
              className="off-button-header"
              onClick={onTurnOff}
              disabled={isLoading}
              title="Turn Off"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
              </svg>
              Off
            </button>
          )}
        </div>
      </div>

      {nextScheduled && (
        <div className="next-scheduled">
          <svg className="clock-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
          </svg>
          Next: {nextScheduled}
        </div>
      )}

      <div className="device-actions">
        <button
          className="action-btn primary"
          onClick={handleTurnOnClick}
          disabled={isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
          </svg>
          <span>On for time</span>
        </button>

        <button
          className="action-btn primary"
          onClick={handleTurnOnToDHWClick}
          disabled={isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4zm-4-8c0-.55.45-1 1-1s1 .45 1 1h-1v1h1v2h-1v1h1v2h-2V5z"/>
          </svg>
          <span>On to DHW</span>
        </button>

        <button
          className="action-btn secondary"
          onClick={onSchedule}
          disabled={isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/>
          </svg>
          <span>Schedule</span>
        </button>

        <button
          className="action-btn secondary"
          onClick={onViewStats}
          disabled={isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
          <span>Stats</span>
        </button>
      </div>

      {/* Duration Picker */}
      {showDurationPicker && (
        <div className="picker-overlay">
          <div className="picker-content">
            <div className="picker-header">
              <h4>Select Duration</h4>
            </div>
            <div className="picker-body">
              <div className="slider-container">
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                  className="duration-slider"
                />
                <div className="slider-value">{durationMinutes} minutes</div>
              </div>
            </div>
            <div className="picker-actions">
              <button className="picker-btn cancel" onClick={() => setShowDurationPicker(false)}>
                Cancel
              </button>
              <button className="picker-btn confirm" onClick={handleDurationConfirm}>
                Turn On
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temperature Picker */}
      {showTempPicker && (
        <div className="picker-overlay">
          <div className="picker-content">
            <div className="picker-header">
              <h4>Select Target Temperature</h4>
            </div>
            <div className="picker-body">
              <div className="slider-container">
                <input
                  type="range"
                  min="30"
                  max="52"
                  step="0.5"
                  value={targetTemp}
                  onChange={(e) => setTargetTemp(parseFloat(e.target.value))}
                  className="temp-slider"
                />
                <div className="slider-value">{targetTemp.toFixed(1)}°C</div>
              </div>
            </div>
            <div className="picker-actions">
              <button className="picker-btn cancel" onClick={() => setShowTempPicker(false)}>
                Cancel
              </button>
              <button className="picker-btn confirm" onClick={handleTempConfirm}>
                Start Heating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceCard;
