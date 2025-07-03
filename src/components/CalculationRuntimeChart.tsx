import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Label } from 'recharts';
import SectionHeader from './SectionHeader';

const data = [
  { month: '2024-10', runtime: 52 },
  { month: '2024-11', runtime: 40 },
  { month: '2024-12', runtime: 28 },
];

const CalculationRuntimeChart = () => (
  <>
    <SectionHeader title="Calculation/Reporting - Runtime" color="#23283B" />
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
        <XAxis dataKey="month" tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
        <YAxis domain={[0, 60]} tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
        <Tooltip />
        <ReferenceLine y={40} stroke="#6C23B7" strokeDasharray="6 3">
          <Label value="SLO" position="left" fill="#6C23B7" fontSize={14} />
        </ReferenceLine>
        <Line type="monotone" dataKey="runtime" stroke="#2323B7" strokeWidth={3} dot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  </>
);

export default CalculationRuntimeChart; 