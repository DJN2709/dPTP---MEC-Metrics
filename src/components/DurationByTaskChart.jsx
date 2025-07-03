import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

// Helper to get the percentage of the month for a date
function getPercentOfMonth(date, monthStart, monthEnd) {
  const total = new Date(monthEnd) - new Date(monthStart);
  const part = new Date(date) - new Date(monthStart);
  return Math.max(0, Math.min(1, part / total));
}

// Colors for each subtask
const subtaskColors = {
  backfill: "#8884d8",
  WD1: "#82ca9d",
  WD2: "#ffc658",
  booked: "#ff7300",
  remaining: "#bdbdbd"
};

const subtaskLabels = {
  backfill: "Backfill",
  WD1: "WD1",
  WD2: "WD2",
  booked: "Booked",
  remaining: "Remaining Tasks"
};

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const { intervals } = payload[0].payload;
  return (
    <div style={{
      background: "#23283B",
      color: "#fff",
      border: "1px solid #A05CF7",
      borderRadius: 10,
      padding: 12,
      fontSize: 14
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {intervals.map((interval, i) => (
        <div key={i} style={{ color: subtaskColors[interval.type] || "#fff" }}>
          <b>{subtaskLabels[interval.type] || interval.type}:</b>
          <br />
          {new Date(interval.start).toLocaleString()} – {new Date(interval.end).toLocaleString()}
          <br />
          Duration: {((new Date(interval.end) - new Date(interval.start)) / 3600000).toFixed(1)}h
        </div>
      ))}
    </div>
  );
}

export default function DurationByTaskChart({ data }) {
  // Defensive: ensure data is always an array
  if (!Array.isArray(data)) data = [];

  // Prepare chart data: one row per month, with subtask intervals as percentages
  const chartData = data.map(monthData => {
    const { month, total, subtasks } = monthData;
    const safeSubtasks = Array.isArray(subtasks) ? subtasks : [];
    const intervals = safeSubtasks.map(st => ({
      ...st,
      startPct: getPercentOfMonth(st.start, total.start, total.end),
      endPct: getPercentOfMonth(st.end, total.start, total.end)
    }));
    return { month, intervals };
  });

  const barWidth = 400;
  const barHeight = 20;
  const barGap = 24;

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 24, marginBottom: 16, marginLeft: 110 }}>
        {Object.entries(subtaskLabels).map(([type, label]) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              display: "inline-block",
              width: 18,
              height: 18,
              background: subtaskColors[type],
              borderRadius: 4,
              border: "1px solid #23283B"
            }} />
            <span style={{ color: "#fff", fontWeight: 600 }}>{label}</span>
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={chartData.length * (barHeight + barGap) + 40}>
        <svg width="100%" height={chartData.length * (barHeight + barGap) + 40}>
          {chartData.map((row, idx) => (
            <g key={row.month} transform={`translate(100, ${idx * (barHeight + barGap) + 20})`}>
              {/* Month label */}
              <text x={-10} y={barHeight / 2 + 5} textAnchor="end" fontWeight={700} fontSize={14} fill="#fff">
                {row.month}
              </text>
              {/* Draw each interval */}
              {row.intervals.map((interval, i) => {
                const x = barWidth * interval.startPct;
                const width = barWidth * (interval.endPct - interval.startPct);
                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={0}
                      width={width}
                      height={barHeight}
                      fill={subtaskColors[interval.type] || "#ccc"}
                      rx={4}
                      style={{ cursor: "pointer" }}
                    />
                    {/* Label for the segment */}
                    {width > 40 && (
                      <text
                        x={x + width / 2}
                        y={barHeight / 2 + 5}
                        textAnchor="middle"
                        fontSize={12}
                        fill="#fff"
                        fontWeight={700}
                        pointerEvents="none"
                      >
                        {subtaskLabels[interval.type] || interval.type}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* Outline for the total bar */}
              <rect
                x={0}
                y={0}
                width={barWidth}
                height={barHeight}
                fill="none"
                stroke="#23283B"
                strokeWidth={2}
                rx={4}
              />
            </g>
          ))}
        </svg>
        {/* Interactive tooltips */}
        <ComposedChart
          width={barWidth}
          height={chartData.length * (barHeight + barGap) + 40}
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, 1]} hide />
          <YAxis type="category" dataKey="month" width={0} hide />
          <Tooltip content={<CustomTooltip />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
} 