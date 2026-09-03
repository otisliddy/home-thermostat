import { useState, useEffect } from 'react';
import './schedule-modal.css';
import { DHW_MAX_TARGET_C, DHW_MIN_TARGET_C, DHW_TARGET_STEP_C } from '../config/dhw';

const ScheduleModal = ({ show, handleConfirm, handleCancel }) => {
  const [startTime, setStartTime] = useState('07:40');
  const [runMode, setRunMode] = useState('duration');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [targetTemp, setTargetTemp] = useState(45);
  const [recurring, setRecurring] = useState(false);
  const [showDurationSlider, setShowDurationSlider] = useState(false);

  const runsToTemperature = runMode === 'temperature';

  // Reset form when modal opens
  useEffect(() => {
    if (show) {
      setStartTime('07:40');
      setRunMode('duration');
      setDurationMinutes(30);
      setTargetTemp(45);
      setRecurring(false);
      setShowDurationSlider(false);
    }
  }, [show]);

  const handleSubmit = () => {
    if (!startTime) {
      alert('Please specify a start time');
      return;
    }
    if (!runsToTemperature && (!durationMinutes || durationMinutes < 1)) {
      alert('Please specify a valid duration');
      return;
    }

    handleConfirm({
      startTime,
      recurring,
      durationSeconds: runsToTemperature ? undefined : durationMinutes * 60,
      dhwTargetTemperature: runsToTemperature ? targetTemp : undefined
    });
  };

  if (!show) {
    return null;
  }

  return (
    <div className="schedule-modal-overlay" onClick={handleCancel}>
      <div className="schedule-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="schedule-modal-header">
          <h2>Schedule Heating</h2>
          <button className="close-button" onClick={handleCancel}>✕</button>
        </div>

        <div className="schedule-modal-body">
          {/* Start Time */}
          <div className="form-group">
            <label htmlFor="start-time">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              Start Time
            </label>
            <input
              id="start-time"
              type="time"
              step="300"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="time-input"
            />
          </div>

          {/* What ends the run */}
          <div className="form-group">
            <label>Run until</label>
            <div className="run-mode-toggle" role="radiogroup" aria-label="Run until">
              <button
                type="button"
                role="radio"
                aria-checked={!runsToTemperature}
                className={`run-mode-btn ${!runsToTemperature ? 'selected' : ''}`}
                onClick={() => setRunMode('duration')}
              >
                A set time
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={runsToTemperature}
                className={`run-mode-btn ${runsToTemperature ? 'selected' : ''}`}
                onClick={() => setRunMode('temperature')}
              >
                A temperature
              </button>
            </div>
          </div>

          {/* Duration */}
          {!runsToTemperature && (
            <div className="form-group">
              <label>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                  <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
                Duration
              </label>
              <div className="duration-display" onClick={() => setShowDurationSlider(!showDurationSlider)}>
                <span className="duration-value">{durationMinutes} minutes</span>
                <svg
                  className={`expand-icon ${showDurationSlider ? 'expanded' : ''}`}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </div>
              {showDurationSlider && (
                <div className="duration-slider-container">
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                    className="duration-slider"
                  />
                  <div className="slider-labels">
                    <span>5m</span>
                    <span>120m</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Target temperature */}
          {runsToTemperature && (
            <div className="form-group">
              <label htmlFor="schedule-target-temp">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4z"/>
                </svg>
                Target Temperature
              </label>
              <div className="duration-slider-container">
                <input
                  id="schedule-target-temp"
                  type="range"
                  min={DHW_MIN_TARGET_C}
                  max={DHW_MAX_TARGET_C}
                  step={DHW_TARGET_STEP_C}
                  value={targetTemp}
                  onChange={(e) => setTargetTemp(parseFloat(e.target.value))}
                  className="temp-slider"
                />
                <div className="slider-value">{targetTemp.toFixed(1)}°C</div>
                <div className="slider-labels">
                  <span>{DHW_MIN_TARGET_C}°C</span>
                  <span>{DHW_MAX_TARGET_C}°C</span>
                </div>
              </div>
            </div>
          )}

          {/* Recurring */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="checkbox-input"
              />
              <div className="checkbox-custom">
                {recurring && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
              </div>
              <span className="checkbox-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{marginRight: '6px'}}>
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                Repeat daily at this time
              </span>
            </label>
            {recurring && (
              <div className="recurring-info">
                {runsToTemperature
                  ? `Heating will turn on every day at ${startTime} until the water reaches ${targetTemp.toFixed(1)}°C`
                  : `Heating will turn on every day at ${startTime} for ${durationMinutes} minutes`}
              </div>
            )}
          </div>
        </div>

        <div className="schedule-modal-footer">
          <button className="modal-btn cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="modal-btn confirm" onClick={handleSubmit}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Schedule Heating
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
