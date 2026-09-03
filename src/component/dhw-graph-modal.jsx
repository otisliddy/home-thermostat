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

// How far from the line a finger still counts as being on it.
const TOUCH_GRAB_PX = 44;

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
  const svgRef = useRef(null);
  const gestureRef = useRef({ kind: 'none' });

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

  const timeRange = domain.end - domain.start || 1;
  const scaleX = useCallback(
    (timestamp) => ((timestamp - domain.start) / timeRange) * PLOT_WIDTH,
    [domain.start, timeRange]
  );

  const nearestPointTo = useCallback(
    (plotX) => {
      if (temperatureData.length === 0) return null;

      const targetTime = domain.start + (plotX / PLOT_WIDTH) * timeRange;

      return temperatureData.reduce((best, candidate) =>
        Math.abs(candidate.timestamp - targetTime) < Math.abs(best.timestamp - targetTime)
          ? candidate
          : best
      );
    },
    [temperatureData, domain.start, timeRange]
  );

  /*
   * Touch has to serve both panning and reading values off the line. Handing horizontal gestures
   * to the browser made that impossible: once it had started a pan, touchmove was no longer
   * cancelable and a finger sliding along the series could not scrub. So horizontal touch is
   * handled here instead, and what the finger landed on decides which it is. touch-action stays
   * pan-y, leaving a vertical swipe to scroll the page as usual.
   */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const plotXOf = (clientX) => clientX - svg.getBoundingClientRect().left;

    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const bounds = svg.getBoundingClientRect();
      const point = nearestPointTo(touch.clientX - bounds.left);
      const onSeries =
        point && Math.abs(touch.clientY - bounds.top - scaleY(point.temperature)) <= TOUCH_GRAB_PX;

      if (onSeries) {
        gestureRef.current = { kind: 'scrub' };
        setHovered(point);
        event.preventDefault();
        return;
      }

      gestureRef.current = {
        kind: 'pan',
        startX: touch.clientX,
        startScrollLeft: scrollerRef.current?.scrollLeft ?? 0
      };
      setHovered(null);
    };

    const onTouchMove = (event) => {
      const gesture = gestureRef.current;
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];

      if (gesture.kind === 'scrub') {
        event.preventDefault();
        setHovered(nearestPointTo(plotXOf(touch.clientX)));
        return;
      }

      if (gesture.kind === 'pan' && scrollerRef.current) {
        event.preventDefault();
        scrollerRef.current.scrollLeft =
          gesture.startScrollLeft - (touch.clientX - gesture.startX);
      }
    };

    const endGesture = () => {
      gestureRef.current = { kind: 'none' };
    };

    svg.addEventListener('touchstart', onTouchStart, { passive: false });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    svg.addEventListener('touchend', endGesture);
    svg.addEventListener('touchcancel', endGesture);

    return () => {
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove', onTouchMove);
      svg.removeEventListener('touchend', endGesture);
      svg.removeEventListener('touchcancel', endGesture);
    };
  }, [nearestPointTo, loading, isOpen]);

  if (!isOpen) return null;

  const handlePointerMove = (event) => {
    if (event.pointerType === 'touch') return;

    const bounds = event.currentTarget.getBoundingClientRect();
    setHovered(nearestPointTo(event.clientX - bounds.left));
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
        {/* Pinned to the top of the chart rather than to the point, so a finger cannot cover it. */}
        {hovered && (
          <div className="graph-readout">
            <span className="graph-readout-value">{hovered.temperature.toFixed(1)}°C</span>
            <span className="graph-readout-time">
              {new Date(hovered.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        )}

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
            ref={svgRef}
            width={PLOT_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${PLOT_WIDTH} ${SVG_HEIGHT}`}
            onPointerMove={handlePointerMove}
            onPointerLeave={(event) => {
              if (event.pointerType !== 'touch') setHovered(null);
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
            <h2>DHW Temperature</h2>
            <p className="dhw-graph-hint">🟦 Immersion 🟧 Oil</p>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="dhw-graph-body">{renderBody()}</div>
      </div>
    </div>
  );
};

export default DhwGraphModal;
