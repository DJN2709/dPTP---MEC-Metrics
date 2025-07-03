import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SectionHeader from './SectionHeader';

const data = [
  { date: 'Feb 27, 2025', passed: 1, failed: 0, aborted: 0 },
  { date: 'Mar 4, 2025', passed: 1, failed: 0, aborted: 0 },
  { date: 'Mar 11, 2025', passed: 1, failed: 0, aborted: 0 },
  { date: 'Mar 17, 2025', passed: 1, failed: 2, aborted: 0 },
  { date: 'Mar 19, 2025', passed: 2, failed: 0, aborted: 0 },
  { date: 'Mar 24, 2025', passed: 1, failed: 0, aborted: 0 },
  { date: 'Mar 28, 2025', passed: 1, failed: 0, aborted: 0 },
  { date: 'Apr 2, 2025', passed: 1, failed: 0, aborted: 1 },
  { date: 'Apr 7, 2025', passed: 2, failed: 0, aborted: 0 },
  { date: 'Apr 15, 2025', passed: 2, failed: 0, aborted: 0 },
  { date: 'Apr 30, 2025', passed: 2, failed: 0, aborted: 0 },
  { date: 'May 1, 2025', passed: 1, failed: 0, aborted: 0 },
];

const CalculationStatusesChart = () => (
  <>
    <SectionHeader title="Calculation Statuses" />
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 0, right: 30, left: 0, bottom: 20 }}>
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#fff', fontWeight: 700 }} angle={-30} textAnchor="end" interval={0} height={60} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
        <YAxis tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
        <Tooltip />
        <Legend verticalAlign="top" height={36} iconType="rect" wrapperStyle={{ fontSize: 16 }} />
        <Bar dataKey="passed" stackId="a" fill="#2323B7" name="passed" />
        <Bar dataKey="failed" stackId="a" fill="#A05CF7" name="failed" />
        <Bar dataKey="aborted" stackId="a" fill="#6C23B7" name="aborted" />
      </BarChart>
    </ResponsiveContainer>
  </>
);

export default CalculationStatusesChart; 