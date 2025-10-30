import React, { useState, useEffect, useRef } from 'react';
import { statusHelper } from 'home-thermostat-common';
import './timeline-chart.css';

const TimelineChart = ({ statuses, scheduledActivity, currentTime = Date.now(), onDeleteScheduled }) => {
  const [tooltip, setTooltip] = useState(null);
  const scrollContainerRef = useRef(null);

  // Timeline spans 24 hours past + 24 hours future (total width)
  const startTime = currentTime - (24 * 60 * 60 * 1000);
  const endTime = currentTime + (24 * 60 * 60 * 1000);
  const totalDuration = endTime - startTime;

  // Scroll to show 4 hours before and after current time on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Wait for render to complete
      setTimeout(() => {
        const scrollableWidth = container.scrollWidth;
        // Calculate position: -4h from now should be at left edge
        // Timeline goes from -24h to +24h, so -4h is at (24-4)/48 = 20/48 = 41.67%
        const scrollPercent = 20 / 48; // 20 hours into a 48 hour timeline
        const scrollPosition = scrollPercent * scrollableWidth;
        container.scrollLeft = scrollPosition;
      }, 0);
    }
  }, []);

  // Convert timestamp to position percentage
  const timeToPercent = (timestamp) => {
    const ms = typeof timestamp === 'number'
      ? (timestamp > 10000000000 ? timestamp : timestamp * 1000)
      : timestamp;
    return ((ms - startTime) / totalDuration) * 100;
  };

  // Format time for display
  const formatTime = (timestamp) => {
    const ms = typeof timestamp === 'number'
      ? (timestamp > 10000000000 ? timestamp : timestamp * 1000)
      : timestamp;
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (start, end) => {
    const startMs = typeof start === 'number'
      ? (start > 10000000000 ? start : start * 1000)
      : start;
    const endMs = typeof end === 'number'
      ? (end > 10000000000 ? end : end * 1000)
      : end;
    const minutes = Math.round((endMs - startMs) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Process historical statuses (past activity)
  const processedHistory = [];
  if (statuses && statuses.length > 0) {
    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];
      if (status.mode === 'Off') continue;

      const since = typeof status.since === 'number'
        ? (status.since > 10000000000 ? status.since : status.since * 1000)
        : status.since;

      // Use helper to calculate actual end time
      const nextStatus = i > 0 ? statuses[i - 1] : null;
      const untilSeconds = statusHelper.getActualEndTime(status, nextStatus, currentTime);
      const until = untilSeconds > 10000000000 ? untilSeconds : untilSeconds * 1000;

      // Only show if visible in timeline
      if (until > startTime && since < endTime) {
        processedHistory.push({
          device: status.device,
          start: Math.max(since, startTime),
          end: Math.min(until, endTime),
          mode: status.mode,
          originalStart: since,
          originalEnd: until,
          type: 'historical'
        });
      }
    }
  }

  // Process scheduled activity (future and current DHW activities)
  const processedScheduled = [];
  if (scheduledActivity && scheduledActivity.length > 0) {
    scheduledActivity.forEach(activity => {
      const since = typeof activity.since === 'number'
        ? (activity.since > 10000000000 ? activity.since : activity.since * 1000)
        : activity.since;

      const until = activity.until
        ? (typeof activity.until === 'number'
          ? (activity.until > 10000000000 ? activity.until : activity.until * 1000)
          : activity.until)
        : since + (30 * 60 * 1000); // Default 30min if no until

      // DHW activities (with dhwTargetTemperature) that are currently running should show as historical
      const isDhwActivity = activity.dhwTargetTemperature !== undefined;
      const isCurrentlyRunning = !activity.until && since <= currentTime;

      if (isDhwActivity && isCurrentlyRunning) {
        // Show running DHW activities as historical (not deletable)
        if (since < endTime) {
          processedHistory.push({
            device: activity.device,
            start: Math.max(since, startTime),
            end: Math.min(currentTime, endTime),
            mode: activity.mode,
            originalStart: since,
            originalEnd: currentTime,
            dhwTargetTemperature: activity.dhwTargetTemperature,
            type: 'historical'
          });
        }
      } else if (until > currentTime && since < endTime) {
        // Show future scheduled activities (deletable)
        processedScheduled.push({
          device: activity.device,
          start: Math.max(since, startTime),
          end: Math.min(until, endTime),
          mode: activity.mode,
          originalStart: since,
          originalEnd: until,
          recurring: activity.recurring,
          dhwTargetTemperature: activity.dhwTargetTemperature,
          type: 'scheduled',
          originalActivity: activity // Store the full activity for deletion
        });
      }
    });
  }

  // Generate hour markers
  const hourMarkers = [];
  const startHour = new Date(startTime);
  startHour.setMinutes(0, 0, 0);
  let markerTime = startHour.getTime() + (60 * 60 * 1000); // Start from next hour

  while (markerTime < endTime) {
    if (markerTime > startTime) {
      hourMarkers.push({
        time: markerTime,
        percent: timeToPercent(markerTime),
        label: new Date(markerTime).toLocaleTimeString([], { hour: 'numeric' })
      });
    }
    markerTime += (60 * 60 * 1000); // Add 1 hour
  }

  const currentPercent = timeToPercent(currentTime);

  const getDeviceColor = (device) => {
    return device === 'ht-main' ? '#ff9800' : '#2196f3'; // Orange for oil, blue for immersion
  };

  const getDeviceName = (device) => {
    return device === 'ht-main' ? 'Oil' : 'Immersion';
  };

  const handleBarClick = (activity, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      ...activity,
      x: rect.left + (rect.width / 2),
      y: rect.top
    });
  };

  const handleClickOutside = () => {
    setTooltip(null);
  };

  return (
    <div className="timeline-chart" onClick={handleClickOutside}>
      <div className="timeline-header">
        <span className="timeline-title">Activity Timeline</span>
        <span className="timeline-range">
          {new Date(startTime).toLocaleDateString()} - {new Date(endTime).toLocaleDateString()}
        </span>
      </div>

      <div className="timeline-scroll-wrapper" ref={scrollContainerRef}>
        <div className="timeline-container">
        {/* Hour markers */}
        {hourMarkers.map((marker, idx) => (
          <div
            key={idx}
            className="hour-marker"
            style={{ left: `${marker.percent}%` }}
          >
            <div className="hour-line" />
            <div className="hour-label">{marker.label}</div>
          </div>
        ))}

        {/* Current time indicator */}
        <div
          className="current-time-indicator"
          style={{ left: `${currentPercent}%` }}
        >
          <div className="current-time-line" />
          <div className="current-time-label">Now</div>
        </div>

        {/* Historical bars */}
        {processedHistory.map((activity, idx) => {
          const left = timeToPercent(activity.start);
          const width = timeToPercent(activity.end) - left;

          return (
            <div
              key={`hist-${idx}`}
              className="timeline-bar historical"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: getDeviceColor(activity.device)
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleBarClick(activity, e);
              }}
            />
          );
        })}

        {/* Scheduled bars */}
        {processedScheduled.map((activity, idx) => {
          const left = timeToPercent(activity.start);
          const width = timeToPercent(activity.end) - left;

          return (
            <div
              key={`sched-${idx}`}
              className="timeline-bar scheduled"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                borderColor: getDeviceColor(activity.device),
                color: getDeviceColor(activity.device)
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleBarClick(activity, e);
              }}
            >
              {activity.recurring && <span className="recurring-indicator">↻</span>}
            </div>
          );
        })}

        </div>
      </div>

      {/* Tooltip - outside scroll wrapper, uses fixed positioning */}
      {tooltip && (
        <div
          className="timeline-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, calc(-100% - 8px))'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tooltip-row">
            <strong>{getDeviceName(tooltip.device)}</strong>
            {tooltip.recurring && <span className="recurring-badge">Recurring</span>}
          </div>
          <div className="tooltip-row">
            {formatTime(tooltip.originalStart)} - {formatTime(tooltip.originalEnd)}
          </div>
          <div className="tooltip-row">
            Duration: {formatDuration(tooltip.originalStart, tooltip.originalEnd)}
          </div>
          {tooltip.dhwTargetTemperature && (
            <div className="tooltip-row">
              Target: {tooltip.dhwTargetTemperature}°C
            </div>
          )}
          <div className="tooltip-type">{tooltip.type === 'scheduled' ? 'Scheduled' : 'Historical'}</div>
          {tooltip.type === 'scheduled' && onDeleteScheduled && (
            <button
              className="tooltip-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteScheduled(tooltip.originalActivity);
                setTooltip(null);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TimelineChart;
