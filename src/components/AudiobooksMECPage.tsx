import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, LabelList, Legend, BarChart, Bar } from 'recharts';
import SectionHeader from './SectionHeader';

function formatDuration(minutes: number | null) {
  if (minutes == null) return '--';
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
}

const AudiobooksMECPage = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepsData, setStepsData] = useState<any[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);
  const [stepsError, setStepsError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:4000/api/audiobooks-mec-highlevel')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch Audiobooks MEC high-level data');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setStepsLoading(true);
    fetch('http://localhost:4000/api/audiobooks-mec-steps-timeline')
      .then(res => res.json())
      .then(data => {
        setStepsData(data);
        setStepsLoading(false);
      })
      .catch(() => {
        setStepsError('Failed to fetch Audiobooks MEC steps timeline data');
        setStepsLoading(false);
      });
  }, []);

  // Helper to convert 'Month Year' to Date
  function monthYearToDate(monthYear: string) {
    const [month, year] = monthYear.split(' ');
    const monthIndex = [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ].indexOf(month);
    return new Date(Number(year), monthIndex);
  }

  // Prepare chart data: show duration in days/hours
  const chartData = data.map(d => ({
    month: d.month,
    duration: d.durationMinutes,
    durationLabel: formatDuration(d.durationMinutes),
  }));

  // Sort chartData chronologically by year and month
  const sortedChartData = [...chartData].sort(
    (a, b) => monthYearToDate(a.month).getTime() - monthYearToDate(b.month).getTime()
  );

  // Map: month -> high-level duration in hours
  const highLevelByMonth = Object.fromEntries(
    data.map(d => [d.month, d.durationMinutes ? d.durationMinutes / 60 : null])
  );

  const stepsChartData = stepsData.map((d: any) => {
    function diffHours(start: string | null, end: string | null) {
      if (!start || !end) return 0;
      return ((new Date(end).getTime() - new Date(start).getTime()) / 3600000);
    }
    // Get raw durations
    const getDuration = (type: string) => {
      const st = d.subtasks?.find((s: any) => s.type === type);
      return st ? diffHours(st.start, st.end) : 0;
    };
    const Backfill = getDuration('backfill');
    const WD1 = getDuration('WD1');
    const WD2 = getDuration('WD2');
    const Booked = getDuration('booked');
    const Remaining = getDuration('remaining');
    const rawTotal = Backfill + WD1 + WD2 + Booked + Remaining;

    // Get high-level duration for this month
    const highLevel = highLevelByMonth[d.month];

    // Proportionally scale each subtask
    function scale(val: number) {
      if (!rawTotal || !highLevel) return null;
      return ((val / rawTotal) * highLevel).toFixed(1);
    }

    return {
      month: d.month,
      Backfill: scale(Backfill),
      WD1: scale(WD1),
      WD2: scale(WD2),
      Booked: scale(Booked),
      Remaining: scale(Remaining),
      total: highLevel ? highLevel.toFixed(1) : null
    };
  });

  // Sort months chronologically
  const sortedStepsChartData = [...stepsChartData].sort(
    (a, b) => monthYearToDate(a.month).getTime() - monthYearToDate(b.month).getTime()
  );

  // Filter out months January 2024 through May 2024 and July 2025 through December 2025 from Duration by Task
  // June 2025 is now supported with proper keyword filtering logic
  const monthsToRemove = [
    'January 2024',
    'February 2024',
    'March 2024',
    'April 2024',
    'May 2024',
    'July 2025',
    'August 2025',
    'September 2025',
    'October 2025',
    'November 2025',
    'December 2025'
  ];
  const filteredStepsChartData = sortedStepsChartData.filter(
    d => !monthsToRemove.includes(d.month)
  );

  return (
    <Box sx={{
      p: { xs: 2, md: 4 },
      minHeight: '100vh',
      background: '#181C23',
      fontFamily: 'Inter, Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif',
    }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
        Audiobooks MEC
      </Typography>
      {/* Line chart for high-level duration */}
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
            <LineChart data={sortedChartData} margin={{ top: 30, right: 40, left: 10, bottom: 40 }}>
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
      {/* New chart for step durations */}
      <Box sx={{
        maxWidth: 1400,
        mx: 'auto',
        p: { xs: 2, md: 4 },
        borderRadius: 4,
        background: '#23283B',
        mt: 4,
        boxShadow: '0 4px 32px #0008',
      }}>
        <SectionHeader title="Duration by Task" color="#23283B" />
        {stepsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress color="secondary" />
          </Box>
        ) : stepsError ? (
          <Alert severity="error">{stepsError}</Alert>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={filteredStepsChartData} margin={{ top: 30, right: 40, left: 10, bottom: 40 }} barCategoryGap={10}>
              <XAxis dataKey="month" angle={-30} textAnchor="end" interval={0} height={70} tick={{ fontSize: 15, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <YAxis
                label={{ value: 'Duration (hours)', angle: -90, position: 'insideLeft', fontSize: 16, fill: '#fff', fontWeight: 700 }}
                tick={{ fontSize: 15, fill: '#fff', fontWeight: 700 }}
                allowDecimals={true}
                axisLine={{ stroke: '#fff' }}
                tickLine={{ stroke: '#fff' }}
              />
              <Tooltip
                formatter={(value) => value == null ? '--' : `${value}h`}
                labelStyle={{ fontWeight: 700, color: '#fff', background: '#23283B' }}
                contentStyle={{ borderRadius: 10, boxShadow: '0 4px 16px #0002', background: '#23283B', border: '1px solid #A05CF7', color: '#fff' }}
                itemStyle={{ fontWeight: 700 }}
                wrapperStyle={{ color: '#fff' }}
              />
              <Legend verticalAlign="bottom" align="left" height={70} iconType="rect" wrapperStyle={{ paddingTop: 40 }} />
              <Bar dataKey="Backfill" fill="#8884d8" stackId="a" />
              <Bar dataKey="WD1" fill="#82ca9d" stackId="a" />
              <Bar dataKey="WD2" fill="#ffc658" stackId="a" />
              <Bar dataKey="Booked" fill="#ff7300" stackId="a" />
              <Bar dataKey="Remaining" fill="#bdbdbd" stackId="a">
                <LabelList dataKey="total" position="top" style={{ fontWeight: 900, fill: '#fff', fontSize: 18, letterSpacing: 1 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default AudiobooksMECPage; 