import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import { statusHelper } from 'home-thermostat-common';
import './dhw-graph-modal.css';
import { DHW_TEMP, isOil } from '../config/devices';

const HOURS_TOTAL = 24;
const HOURS_VISIBLE = 6;
const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = HOURS_TOTAL * HOUR_MS;

// 9px per degree over 0-55, so a five degree tick lands on exactly 45px.
const PX_PER_HOUR = 120;
const PLOT_WIDTH = HOURS_TOTAL * PX_PER_HOUR;
const PLOT_HEIGHT = 495;
const PADDING_TOP = 25;
const PADDING_BOTTOM = 40;
const SVG_HEIGHT = PLOT_HEIGHT + PADDING_TOP + PADDING_BOTTOM;
const AXIS_WIDTH = 52;

const Y_MIN = 0;
const Y_MAX = 55;
const Y_TICK_STEP = 5;

const scaleY = (temp) =>
  PADDING_TOP + PLOT_HEIGHT - ((temp - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_HEIGHT;

const yAxisTicks = [];
for (let temp = Y_MIN; temp <= Y_MAX; temp += Y_TICK_STEP) {
  yAxisTicks.push(temp);
}

const toMs = (seconds) => (seconds > 10000000000 ? seconds : seconds * 1000);

const DhwGraphModal = ({ isOpen, onClose, dynamodbClient, temperatureTableName, statuses }) => {
  const [temperatureData, setTemperatureData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState({ start: 0, end: 0 });
  const [hovered, setHovered] = useState(null);
  const scrollerRef = useRef(null);
  const touchHoldRef = useRef(null);

  const fetchTemperatureData = useCallback(async () => {
    setLoading(true);
    const end = Date.now();
    const start = end - WINDOW_MS;
    setDomain({ start, end });

    try {
      const params = {
        TableName: temperatureTableName,
        KeyConditionExpression: 'device = :device AND #ts > :since',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: {
          ':device': { S: DHW_TEMP },
          ':since': { N: start.toString() }
        },
        ScanIndexForward: true
      };

      const data = await dynamodbClient.dynamodb.send(new QueryCommand(params));

      const temps = (data.Items ?? [])
        .map((item) => ({
          timestamp: parseInt(item.timestamp?.N),
          temperature: parseFloat(item.temperature?.N)
        }))
        .filter((d) => Number.isFinite(d.timestamp) && Number.isFinite(d.temperature))
        .sort((a, b) => a.timestamp - b.timestamp);

      setTemperatureData(temps);
    } catch (error) {
      console.error('Error fetching temperature data:', error);
      setTemperatureData([]);
    } finally {
      setLoading(false);
    }
  }, [dynamodbClient, temperatureTableName]);

  useEffect(() => {
    if (isOpen) {
      setHovered(null);
      fetchTemperatureData();
    }
  }, [isOpen, fetchTemperatureData]);

  // The newest readings are the ones worth seeing first, so open at the right-hand edge.
  useEffect(() => {
    if (!loading && scrollerRef.current) {
      scrollerRef.current.scrollLeft = scrollerRef.current.scrollWidth;
    }
  }, [loading, temperatureData]);

  if (!isOpen) return null;

  const timeRange = domain.end - domain.start || 1;
  const scaleX = (timestamp) => ((timestamp - domain.start) / timeRange) * PLOT_WIDTH;

  const nearestPointTo = (plotX) => {
    if (temperatureData.length === 0) return null;

    const targetTime = domain.start + (plotX / PLOT_WIDTH) * timeRange;

    return temperatureData.reduce((best, candidate) =>
      Math.abs(candidate.timestamp - targetTime) < Math.abs(best.timestamp - targetTime)
        ? candidate
        : best
    );
  };

  const showValueAt = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setHovered(nearestPointTo(event.clientX - bounds.left));
  };

  const handlePointerMove = (event) => {
    if (event.pointerType === 'touch') {
      // A moving finger is panning the chart, not asking for a reading.
      clearTimeout(touchHoldRef.current);
      setHovered(null);
      return;
    }
    showValueAt(event);
  };

  /*
   * Touch has to choose between panning and inspecting. A short hold that has not turned into a
   * pan reads as inspecting, which leaves an ordinary swipe free to scroll.
   */
  const handlePointerDown = (event) => {
    if (event.pointerType !== 'touch') return;

    const { clientX, currentTarget } = event;
    const bounds = currentTarget.getBoundingClientRect();
    clearTimeout(touchHoldRef.current);
    touchHoldRef.current = setTimeout(() => {
      setHovered(nearestPointTo(clientX - bounds.left));
    }, 200);
  };

  const endTouch = () => {
    clearTimeout(touchHoldRef.current);
  };

  const renderBody = () => {
    if (loading) {
      return <div className="graph-loading">Loading temperature data...</div>;
    }

    if (temperatureData.length === 0) {
      return <div className="graph-empty">No temperature data available</div>;
    }

    const linePath = temperatureData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.timestamp)},${scaleY(d.temperature)}`)
      .join(' ');

    const heatingPeriods = [];
    if (statuses && statuses.length > 0) {
      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        if (status.mode === 'Off') continue;

        const sinceMs = toMs(status.since);
        const nextStatus = statusHelper.findNextStatusForDevice(statuses, i);
        const untilMs = toMs(statusHelper.getActualEndTime(status, nextStatus, domain.end));

        if (untilMs > domain.start && sinceMs < domain.end) {
          heatingPeriods.push({
            device: status.device,
            start: Math.max(sinceMs, domain.start),
            end: Math.min(untilMs, domain.end)
          });
        }
      }
    }

    const xAxisTicks = [];
    const firstTick = new Date(domain.start);
    firstTick.setMinutes(0, 0, 0);
    for (let t = firstTick.getTime() + HOUR_MS; t <= domain.end; t += HOUR_MS) {
      xAxisTicks.push(t);
    }

    const tickAnchor = (x) => {
      if (x < 20) return 'start';
      if (x > PLOT_WIDTH - 20) return 'end';
      return 'middle';
    };

    return (
      <div className="graph-layout">
        <svg
          className="graph-y-axis"
          width={AXIS_WIDTH}
          height={SVG_HEIGHT}
          viewBox={`0 0 ${AXIS_WIDTH} ${SVG_HEIGHT}`}
        >
          {yAxisTicks.map((temp) => (
            <text
              key={`y-${temp}`}
              x={AXIS_WIDTH - 10}
              y={scaleY(temp)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="12"
              fill="#666"
            >
              {temp}°
            </text>
          ))}
          <line
            x1={AXIS_WIDTH - 1}
            y1={PADDING_TOP}
            x2={AXIS_WIDTH - 1}
            y2={PADDING_TOP + PLOT_HEIGHT}
            stroke="#333"
            strokeWidth="2"
          />
        </svg>

        <div
          className="graph-scroller"
          ref={scrollerRef}
          style={{ maxWidth: HOURS_VISIBLE * PX_PER_HOUR }}
        >
          <svg
            className="temperature-graph"
            width={PLOT_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${PLOT_WIDTH} ${SVG_HEIGHT}`}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={endTouch}
            onPointerCancel={endTouch}
            onPointerLeave={() => {
              endTouch();
              setHovered(null);
            }}
          >
            {heatingPeriods.map((period, idx) => (
              <rect
                key={`heating-${idx}`}
                x={scaleX(period.start)}
                y={PADDING_TOP}
                width={Math.max(scaleX(period.end) - scaleX(period.start), 1)}
                height={PLOT_HEIGHT}
                fill={isOil(period.device) ? 'rgba(255, 152, 0, 0.12)' : 'rgba(33, 150, 243, 0.12)'}
              />
            ))}

            {yAxisTicks.map((temp) => (
              <line
                key={`grid-y-${temp}`}
                x1={0}
                y1={scaleY(temp)}
                x2={PLOT_WIDTH}
                y2={scaleY(temp)}
                stroke="#e0e0e0"
                strokeWidth="1"
              />
            ))}

            {xAxisTicks.map((time) => (
              <line
                key={`grid-x-${time}`}
                x1={scaleX(time)}
                y1={PADDING_TOP}
                x2={scaleX(time)}
                y2={PADDING_TOP + PLOT_HEIGHT}
                stroke="#e0e0e0"
                strokeWidth="1"
              />
            ))}

            <line
              x1={0}
              y1={PADDING_TOP + PLOT_HEIGHT}
              x2={PLOT_WIDTH}
              y2={PADDING_TOP + PLOT_HEIGHT}
              stroke="#333"
              strokeWidth="2"
            />

            {xAxisTicks.map((time) => (
              <text
                key={`label-x-${time}`}
                x={scaleX(time)}
                y={PADDING_TOP + PLOT_HEIGHT + 22}
                textAnchor={tickAnchor(scaleX(time))}
                fontSize="12"
                fill="#666"
              >
                {new Date(time).toLocaleTimeString([], { hour: 'numeric', hour12: true })}
              </text>
            ))}

            <path d={linePath} fill="none" stroke="#2196f3" strokeWidth="2" />

            {hovered && (
              <g pointerEvents="none">
                <line
                  x1={scaleX(hovered.timestamp)}
                  y1={PADDING_TOP}
                  x2={scaleX(hovered.timestamp)}
                  y2={PADDING_TOP + PLOT_HEIGHT}
                  stroke="#2196f3"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <circle
                  cx={scaleX(hovered.timestamp)}
                  cy={scaleY(hovered.temperature)}
                  r="5"
                  fill="#2196f3"
                  stroke="#fff"
                  strokeWidth="2"
                />
                {(() => {
                  const boxWidth = 104;
                  const boxHeight = 42;
                  const x = Math.min(
                    Math.max(scaleX(hovered.timestamp) - boxWidth / 2, 2),
                    PLOT_WIDTH - boxWidth - 2
                  );
                  const y = Math.max(scaleY(hovered.temperature) - boxHeight - 12, PADDING_TOP);

                  return (
                    <g>
                      <rect
                        x={x}
                        y={y}
                        width={boxWidth}
                        height={boxHeight}
                        rx="6"
                        fill="#263238"
                        opacity="0.95"
                      />
                      <text x={x + boxWidth / 2} y={y + 17} textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff">
                        {hovered.temperature.toFixed(1)}°C
                      </text>
                      <text x={x + boxWidth / 2} y={y + 33} textAnchor="middle" fontSize="11" fill="#b0bec5">
                        {new Date(hovered.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="dhw-graph-modal-overlay" onClick={onClose}>
      <div className="dhw-graph-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="dhw-graph-header">
          <div>
            <h2>DHW Temperature (Last {HOURS_TOTAL} Hours)</h2>
            <p className="dhw-graph-hint">
              Drag to pan · hover or hold to read a value · 🟦 Immersion 🟧 Oil
            </p>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="dhw-graph-body">{renderBody()}</div>
      </div>
    </div>
  );
};

export default DhwGraphModal;
