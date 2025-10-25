import React, { useState, useEffect } from 'react';
import './dhw-graph-modal.css';

const DhwGraphModal = ({ isOpen, onClose, dynamodbClient, temperatureTableName, statuses }) => {
  const [temperatureData, setTemperatureData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchTemperatureData();
    }
  }, [isOpen]);

  const fetchTemperatureData = async () => {
    setLoading(true);
    try {
      // Fetch last 4 hours of temperature data
      const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
      const fourHoursAgoSeconds = Math.floor(fourHoursAgo / 1000);

      // Query temperature table for ht-dhw-temp device
      const params = {
        TableName: temperatureTableName,
        KeyConditionExpression: 'device = :device AND #ts > :since',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':device': { S: 'ht-dhw-temp' },
          ':since': { N: fourHoursAgo.toString() }
        },
        ScanIndexForward: true // Oldest first
      };

      const data = await dynamodbClient.dynamodb.send(
        new (await import('@aws-sdk/client-dynamodb')).QueryCommand(params)
      );

      if (data.Items) {
        const temps = data.Items.map(item => ({
          timestamp: parseInt(item.timestamp?.N),
          temperature: parseFloat(item.temperature?.N)
        })).sort((a, b) => a.timestamp - b.timestamp);

        setTemperatureData(temps);
      }
    } catch (error) {
      console.error('Error fetching temperature data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderGraph = () => {
    if (loading) {
      return <div className="graph-loading">Loading temperature data...</div>;
    }

    if (temperatureData.length === 0) {
      return <div className="graph-empty">No temperature data available</div>;
    }

    // Calculate graph dimensions
    const width = 800;
    const height = 300;
    const padding = { top: 20, right: 40, bottom: 40, left: 50 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Find min/max values
    const temperatures = temperatureData.map(d => d.temperature);
    const minTemp = Math.floor(Math.min(...temperatures) - 2);
    const maxTemp = Math.ceil(Math.max(...temperatures) + 2);

    const timestamps = temperatureData.map(d => d.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1; // Avoid division by zero

    // Scale functions
    const scaleX = (timestamp) => {
      return padding.left + ((timestamp - minTime) / timeRange) * graphWidth;
    };

    const scaleY = (temp) => {
      return padding.top + graphHeight - ((temp - minTemp) / (maxTemp - minTemp)) * graphHeight;
    };

    // Generate path for temperature line
    const linePath = temperatureData
      .map((d, i) => {
        const x = scaleX(d.timestamp);
        const y = scaleY(d.temperature);
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');

    // Generate heating markers
    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    const heatingPeriods = [];

    if (statuses && statuses.length > 0) {
      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        if (status.mode === 'Off') continue;

        const sinceMs = status.since > 10000000000 ? status.since : status.since * 1000;

        // Determine end time
        let untilMs;
        if (status.until) {
          untilMs = status.until > 10000000000 ? status.until : status.until * 1000;
        } else if (i > 0) {
          untilMs = statuses[i - 1].since > 10000000000
            ? statuses[i - 1].since
            : statuses[i - 1].since * 1000;
        } else {
          untilMs = Date.now();
        }

        // Only show if within 4 hour window
        if (untilMs > fourHoursAgo && sinceMs < Date.now()) {
          heatingPeriods.push({
            device: status.device,
            start: Math.max(sinceMs, fourHoursAgo),
            end: Math.min(untilMs, Date.now())
          });
        }
      }
    }

    // Generate Y-axis labels
    const yAxisTicks = [];
    const tempStep = Math.ceil((maxTemp - minTemp) / 5);
    for (let temp = minTemp; temp <= maxTemp; temp += tempStep) {
      yAxisTicks.push(temp);
    }

    // Generate X-axis labels
    const xAxisTicks = [];
    const timeStep = timeRange / 6;
    for (let i = 0; i <= 6; i++) {
      const time = minTime + (timeStep * i);
      xAxisTicks.push(time);
    }

    return (
      <svg className="temperature-graph" viewBox={`0 0 ${width} ${height}`}>
        {/* Heating period backgrounds */}
        {heatingPeriods.map((period, idx) => {
          const x1 = scaleX(period.start);
          const x2 = scaleX(period.end);
          const color = period.device === 'ht-main' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(33, 150, 243, 0.1)';

          return (
            <rect
              key={`heating-${idx}`}
              x={x1}
              y={padding.top}
              width={x2 - x1}
              height={graphHeight}
              fill={color}
            />
          );
        })}

        {/* Grid lines */}
        {yAxisTicks.map((temp, idx) => (
          <line
            key={`grid-y-${idx}`}
            x1={padding.left}
            y1={scaleY(temp)}
            x2={padding.left + graphWidth}
            y2={scaleY(temp)}
            stroke="#e0e0e0"
            strokeWidth="1"
          />
        ))}

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + graphHeight}
          stroke="#333"
          strokeWidth="2"
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + graphHeight}
          x2={padding.left + graphWidth}
          y2={padding.top + graphHeight}
          stroke="#333"
          strokeWidth="2"
        />

        {/* Y-axis labels */}
        {yAxisTicks.map((temp, idx) => (
          <text
            key={`label-y-${idx}`}
            x={padding.left - 10}
            y={scaleY(temp)}
            textAnchor="end"
            alignmentBaseline="middle"
            fontSize="12"
            fill="#666"
          >
            {temp}°C
          </text>
        ))}

        {/* X-axis labels */}
        {xAxisTicks.map((time, idx) => (
          <text
            key={`label-x-${idx}`}
            x={scaleX(time)}
            y={padding.top + graphHeight + 25}
            textAnchor="middle"
            fontSize="12"
            fill="#666"
          >
            {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </text>
        ))}

        {/* Temperature line */}
        <path
          d={linePath}
          fill="none"
          stroke="#2196f3"
          strokeWidth="2"
        />

        {/* Temperature points */}
        {temperatureData.map((d, idx) => (
          <circle
            key={`point-${idx}`}
            cx={scaleX(d.timestamp)}
            cy={scaleY(d.temperature)}
            r="3"
            fill="#2196f3"
          />
        ))}

        {/* Legend */}
        <text x={padding.left + graphWidth - 100} y={padding.top + 15} fontSize="12" fill="#666">
          🟦 Immersion 🟧 Oil
        </text>
      </svg>
    );
  };

  return (
    <div className="dhw-graph-modal-overlay" onClick={onClose}>
      <div className="dhw-graph-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="dhw-graph-header">
          <h2>DHW Temperature (Last 4 Hours)</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="dhw-graph-body">
          {renderGraph()}
        </div>
      </div>
    </div>
  );
};

export default DhwGraphModal;
