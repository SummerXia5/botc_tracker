import { useRef } from 'react';
import './RadarChart.css';

/**
 * Pure SVG Pentagon radar chart — Light Theme.
 * Clean lines, warm gold data fill, no glow filters.
 * @param {Array} dimensions - Array of { label, value (0-100) }
 * @param {number} size - Chart size in px (default 260)
 */
export default function RadarChart({ dimensions = [], size = 260 }) {
  const svgRef = useRef(null);
  const center = size / 2;
  const radius = size / 2 - 44;
  const levels = 4;
  const angleStep = (2 * Math.PI) / dimensions.length;
  // Start from top (-π/2)
  const startAngle = -Math.PI / 2;

  const getPoint = (index, value) => {
    const angle = startAngle + index * angleStep;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Grid lines (concentric pentagons)
  const gridPaths = [];
  for (let level = 1; level <= levels; level++) {
    const points = [];
    for (let i = 0; i < dimensions.length; i++) {
      const p = getPoint(i, (level / levels) * 100);
      points.push(`${p.x},${p.y}`);
    }
    gridPaths.push(points.join(' '));
  }

  // Axis lines
  const axisLines = dimensions.map((_, i) => {
    const p = getPoint(i, 100);
    return { x1: center, y1: center, x2: p.x, y2: p.y };
  });

  // Data polygon
  const dataPoints = dimensions.map((d, i) => {
    const p = getPoint(i, d.value);
    return `${p.x},${p.y}`;
  }).join(' ');

  // Labels positioned outside
  const labels = dimensions.map((d, i) => {
    const p = getPoint(i, 125);
    return { ...d, x: p.x, y: p.y };
  });

  // Value dots
  const dots = dimensions.map((d, i) => getPoint(i, d.value));

  return (
    <div className="rc-container">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rc-svg"
      >
        {/* Grid pentagons */}
        {gridPaths.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="rgba(26, 25, 24, 0.08)"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(26, 25, 24, 0.08)"
            strokeWidth="1"
          />
        ))}

        {/* Data polygon — warm gold transparent fill */}
        <polygon
          points={dataPoints}
          fill="rgba(184, 148, 31, 0.12)"
          stroke="#B8941F"
          strokeWidth="2"
          className="rc-data"
        />

        {/* Vertex dots */}
        {dots.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r="4"
            fill="#B8941F"
            className="rc-dot"
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}

        {/* Labels + score values */}
        {labels.map((label, i) => (
          <g key={i}>
            <text
              x={label.x}
              y={label.y - 7}
              textAnchor="middle"
              dominantBaseline="middle"
              className="rc-label"
              fill="#57534E"
              fontSize="11"
              fontWeight="500"
            >
              {label.label}
            </text>
            <text
              x={label.x}
              y={label.y + 9}
              textAnchor="middle"
              dominantBaseline="middle"
              className="rc-score"
              fill="#B8941F"
              fontSize="12"
              fontWeight="600"
            >
              {label.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
