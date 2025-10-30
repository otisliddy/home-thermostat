import React, { useState, useMemo } from 'react';
import { statusHelper } from 'home-thermostat-common';
import './history-stats.css';

const HistoryStats = ({ statuses, device, deviceName }) => {
  const [daysRange, setDaysRange] = useState(7);
  const [isExpanded, setIsExpanded] = useState(true);

  const stats = useMemo(() => {
    if (!statuses || statuses.length === 0) {
      return {
        totalMinutes: 0,
        totalHours: 0,
        averagePerDay: 0,
        entries: []
      };
    }

    const sinceDaysAgo = new Date();
    sinceDaysAgo.setTime(sinceDaysAgo.getTime() - daysRange * 24 * 60 * 60 * 1000);
    const sinceDaysAgoSeconds = sinceDaysAgo.getTime() / 1000;

    let totalSeconds = 0;
    const entries = [];

    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];

      // Only process ON statuses for this device
      if (status.mode !== 'On' || status.device !== device) continue;

      // Stop if we've gone past our date range
      if (status.since < sinceDaysAgoSeconds) break;

      const nextStatus = i > 0 ? statuses[i - 1] : null;

      // Use helper to calculate actual end time
      const untilSeconds = statusHelper.getActualEndTime(status, nextStatus, Date.now());

      const durationSeconds = untilSeconds - status.since;
      totalSeconds += durationSeconds;

      entries.push({
        since: status.since,
        until: untilSeconds,
        duration: durationSeconds
      });
    }

    const totalMinutes = Math.round(totalSeconds / 60);
    const totalHours = (totalSeconds / 3600).toFixed(1);
    const averagePerDay = (totalMinutes / daysRange).toFixed(0);

    return {
      totalMinutes,
      totalHours,
      averagePerDay,
      entries
    };
  }, [statuses, device, daysRange]);

  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="history-stats">
      <div className="stats-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>{deviceName} Usage History</h3>
        <svg
          className={`expand-arrow ${isExpanded ? 'expanded' : ''}`}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>

      {isExpanded && (
        <div className="stats-content">
          <div className="stats-controls">
            <label htmlFor="days-select">Show last:</label>
            <select
              id="days-select"
              value={daysRange}
              onChange={(e) => setDaysRange(parseInt(e.target.value))}
              className="days-select"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <div className="stats-summary">
            <div className="stat-card">
              <div className="stat-label">Total Usage</div>
              <div className="stat-value">{stats.totalHours}h</div>
              <div className="stat-sub">({stats.totalMinutes} minutes)</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Average per Day</div>
              <div className="stat-value">{stats.averagePerDay}</div>
              <div className="stat-sub">minutes/day</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Sessions</div>
              <div className="stat-value">{stats.entries.length}</div>
              <div className="stat-sub">heating cycles</div>
            </div>
          </div>

          <div className="stats-detail">
            <h4>Activity Log</h4>
            {stats.entries.length > 0 ? (
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Ended</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.entries.map((entry, idx) => (
                    <tr key={idx}>
                      <td>{formatTime(entry.since)}</td>
                      <td>{formatTime(entry.until)}</td>
                      <td>{formatDuration(entry.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">No activity in the selected time range</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryStats;
