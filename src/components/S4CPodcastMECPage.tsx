import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, LabelList, Legend } from 'recharts';
import SectionHeader from './SectionHeader';

function formatDuration(minutes: number | null) {
  if (minutes == null) return '--';
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
}

const S4CPodcastMECPage = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:4000/api/s4c-podcast-mec-highlevel')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch S4C Podcast MEC high-level data');
        setLoading(false);
      });
  }, []);

  // Prepare chart data: show duration in days/hours
  const chartData = data.map(d => ({
    month: d.month,
    duration: d.durationMinutes,
    durationLabel: formatDuration(d.durationMinutes),
  }));

  // Sort chartData chronologically by year and month
  function monthYearToDate(monthYear: string) {
    const [month, year] = monthYear.split(' ');
    const monthIndex = [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ].indexOf(month);
    return new Date(Number(year), monthIndex);
  }
  const sortedChartData = [...chartData].sort(
    (a, b) => monthYearToDate(a.month).getTime() - monthYearToDate(b.month).getTime()
  );

  // Filter out January 2024 and all months before June 2024, and all months after the latest month with data
  const monthsToRemove = [
    'January 2024', 'February 2024', 'March 2024', 'April 2024', 'May 2024'
  ];
  // Find the latest month with nonzero duration or any data
  const monthsWithData = sortedChartData.filter(d => d.duration !== null && d.duration !== undefined);
  let latestMonthIdx = monthsWithData.length > 0 ? sortedChartData.findIndex(d => d.month === monthsWithData[monthsWithData.length - 1].month) : -1;
  const filteredChartData = sortedChartData.filter((d, idx) => !monthsToRemove.includes(d.month) && (latestMonthIdx === -1 || idx <= latestMonthIdx));

  return (
    <Box sx={{
      p: { xs: 2, md: 4 },
      minHeight: '100vh',
      background: '#181C23',
      fontFamily: 'Inter, Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif',
    }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
        S4C Podcast MEC
      </Typography>
      <Box sx={{
        maxWidth: 1400,
        mx: 'auto',
        p: { xs: 2, md: 4 },
        borderRadius: 4,
        background: '#23283B',
        mt: 4,
        boxShadow: '0 4px 32px #0008',
      }}>
        <SectionHeader title="High-level duration (Line Chart)" color="#23283B" />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress color="secondary" />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={filteredChartData} margin={{ top: 30, right: 40, left: 10, bottom: 40 }}>
              <XAxis dataKey="month" angle={-30} textAnchor="end" interval={0} height={70} tick={{ fontSize: 15, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <YAxis
                label={{ value: 'Duration (hours)', angle: -90, position: 'insideLeft', fontSize: 16, fill: '#fff', fontWeight: 700 }}
                tick={{ fontSize: 15, fill: '#fff', fontWeight: 700 }}
                allowDecimals={true}
                axisLine={{ stroke: '#fff' }}
                tickLine={{ stroke: '#fff' }}
                tickFormatter={v => v == null ? '' : String((v / 60).toFixed(1))}
              />
              <Tooltip
                formatter={(value) => typeof value === 'number' ? formatDuration(value) : '--'}
                labelStyle={{ fontWeight: 700, color: '#fff', background: '#23283B' }}
                contentStyle={{ borderRadius: 10, boxShadow: '0 4px 16px #0002', background: '#23283B', border: '1px solid #A05CF7', color: '#fff' }}
                itemStyle={{ color: '#A05CF7', fontWeight: 700 }}
                wrapperStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="duration" stroke="#A05CF7" strokeWidth={3} dot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default S4CPodcastMECPage; 