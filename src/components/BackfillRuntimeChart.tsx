import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Label } from 'recharts';
import SectionHeader from './SectionHeader';

const data = [
  { month: '2024-12', completion_minutes: 830 },
  { month: '2025-01', completion_minutes: 949 },
  { month: '2025-02', completion_minutes: 870 },
  { month: '2025-03', completion_minutes: 994 },
  { month: '2025-04', completion_minutes: 939 },
];

const BackfillRuntimeChart = () => (
  <>
    <SectionHeader title="MEC Readiness - Lead time" color="#23283B" />
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
        <XAxis dataKey="month" tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
        <YAxis domain={[750, 2000]} tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
        <Tooltip />
        <ReferenceLine y={2000} stroke="#6C23B7" strokeDasharray="6 3">
          <Label value="SLO" position="left" fill="#6C23B7" fontSize={14} />
        </ReferenceLine>
        <ReferenceLine y={1250} stroke="#2323B7" strokeDasharray="6 3">
          <Label value="Target" position="left" fill="#2323B7" fontSize={14} />
        </ReferenceLine>
        <Line type="monotone" dataKey="completion_minutes" stroke="#2323B7" strokeWidth={3} dot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  </>
);

export default BackfillRuntimeChart; 