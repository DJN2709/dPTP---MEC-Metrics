import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend, LineChart, Line } from 'recharts';
import SectionHeader from './SectionHeader';

function formatDuration(minutes: number | null) {
  if (minutes == null) return '--';
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
}

const LyricsMECPage = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepsData, setStepsData] = useState<any[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);
  const [stepsError, setStepsError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Fetch data from lyrics endpoints
    fetch('http://localhost:4000/api/lyrics-mec-highlevel').then(res => res.json()).then((lyricsData) => {
      setData(lyricsData);
      setLoading(false);
    }).catch(() => {
      setError('Failed to fetch Lyrics MEC high-level data');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setStepsLoading(true);
    // Fetch data from lyrics steps timeline endpoint
    fetch('http://localhost:4000/api/lyrics-mec-steps-timeline').then(res => res.json()).then((lyricsData) => {
      setStepsData(lyricsData);
      setStepsLoading(false);
    }).catch(() => {
      setStepsError('Failed to fetch Lyrics MEC steps timeline data');
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

  // Filter steps data to only include months that exist in high-level data
  // (i.e., months that have both MEC update start and booked end)
  const filteredStepsData = stepsData.filter(d => highLevelByMonth[d.month] !== undefined);

  // Prepare step durations for chart
  const stepsChartData = filteredStepsData.map((d: any) => {
    function diffHours(start: string | null, end: string | null) {
      if (!start || !end) return 0;
      return ((new Date(end).getTime() - new Date(start).getTime()) / 3600000);
    }

    let Backfill, WD1, WD2, WD3;

    // Handle different data formats: old format (direct properties) vs new format (subtasks array)
    if (d.subtasks && Array.isArray(d.subtasks)) {
      // New format: subtasks array (June 2025+)
      const getDuration = (type: string) => {
        const st = d.subtasks?.find((s: any) => s.type === type);
        return st ? diffHours(st.start, st.end) : 0;
      };
      Backfill = getDuration('backfill');
      WD1 = getDuration('WD1');
      WD2 = getDuration('WD2');
      WD3 = getDuration('WD3');
    } else {
      // Old format: direct properties (Jan 2024 - May 2025)
      Backfill = diffHours(d.backfill?.start, d.backfill?.end) || 0;
      WD1 = diffHours(d.wd1?.start, d.wd1?.end) || 0;
      WD2 = diffHours(d.wd2?.start, d.wd2?.end) || 0;
      WD3 = diffHours(d.wd3?.start, d.wd3?.end) || 0;
    }

    const rawTotal = Backfill + WD1 + WD2 + WD3;

    // Get high-level duration for this month
    const highLevel = highLevelByMonth[d.month];

    // Check if we have reliable step data vs high-level data
    const hasCompleteStepData = Backfill > 0 && WD1 > 0 && WD2 > 0 && WD3 > 0;
    const scaleFactor = highLevel && rawTotal > 0 ? highLevel / rawTotal : 1;
    
    // Only scale if the scale factor is reasonable (between 0.5 and 2.0)
    // This prevents massive scaling when data ranges don't align
    const isReasonableScale = scaleFactor >= 0.5 && scaleFactor <= 2.0;

    if (highLevel && hasCompleteStepData && isReasonableScale) {
      // Scale proportionally when we have complete, reasonable data
      return {
        month: d.month,
        Backfill: parseFloat((Backfill * scaleFactor).toFixed(1)),
        WD1: parseFloat((WD1 * scaleFactor).toFixed(1)),
        WD2: parseFloat((WD2 * scaleFactor).toFixed(1)),
        WD3: parseFloat((WD3 * scaleFactor).toFixed(1)),
        total: parseFloat(highLevel.toFixed(1))
      };
    } else if (highLevel) {
      // Use high-level duration, distribute based on typical patterns or equal shares
      // For months with incomplete step data, use a reasonable distribution
      const hasAnyStepData = rawTotal > 0;
      
      if (hasAnyStepData && !isReasonableScale) {
        // Use proportional distribution based on available step data, but cap the total
        const normalizedBackfill = rawTotal > 0 ? (Backfill / rawTotal) * highLevel : highLevel * 0.4;
        const normalizedWD1 = rawTotal > 0 ? (WD1 / rawTotal) * highLevel : highLevel * 0.2;
        const normalizedWD2 = rawTotal > 0 ? (WD2 / rawTotal) * highLevel : highLevel * 0.2;
        const normalizedWD3 = rawTotal > 0 ? (WD3 / rawTotal) * highLevel : highLevel * 0.2;
        
        return {
          month: d.month,
          Backfill: parseFloat(normalizedBackfill.toFixed(1)),
          WD1: parseFloat(normalizedWD1.toFixed(1)),
          WD2: parseFloat(normalizedWD2.toFixed(1)),
          WD3: parseFloat(normalizedWD3.toFixed(1)),
          total: parseFloat(highLevel.toFixed(1))
        };
      } else {
        // Equal distribution when no step data
        const equalShare = highLevel / 4;
        return {
          month: d.month,
          Backfill: parseFloat(equalShare.toFixed(1)),
          WD1: parseFloat(equalShare.toFixed(1)),
          WD2: parseFloat(equalShare.toFixed(1)),
          WD3: parseFloat(equalShare.toFixed(1)),
          total: parseFloat(highLevel.toFixed(1))
        };
      }
    } else {
      // Fallback to raw data if no high-level duration
      return {
        month: d.month,
        Backfill: parseFloat(Backfill.toFixed(1)),
        WD1: parseFloat(WD1.toFixed(1)),
        WD2: parseFloat(WD2.toFixed(1)),
        WD3: parseFloat(WD3.toFixed(1)),
        total: parseFloat(rawTotal.toFixed(1))
      };
    }
  });

  // Sort steps chart data chronologically
  const sortedStepsChartData = [...stepsChartData].sort(
    (a, b) => monthYearToDate(a.month).getTime() - monthYearToDate(b.month).getTime()
  );

  // Debug logs for troubleshooting missing months (uncomment if needed)
  // console.log('stepsData:', stepsData);
  // console.log('stepsChartData:', stepsChartData);

  return (
    <Box sx={{
      p: { xs: 2, md: 4 },
      minHeight: '100vh',
      background: '#181C23',
      fontFamily: 'Inter, Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif',
    }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
        Lyrics MEC
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
            <BarChart data={sortedStepsChartData} margin={{ top: 30, right: 40, left: 10, bottom: 40 }} barCategoryGap={10}>
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
              <Bar dataKey="Backfill" fill="#A05CF7" isAnimationActive={true} animationDuration={1200} maxBarSize={120} stackId="a" />
              <Bar dataKey="WD1" fill="#42a5f5" isAnimationActive={true} animationDuration={1200} maxBarSize={120} stackId="a" />
              <Bar dataKey="WD2" fill="#6a1b9a" isAnimationActive={true} animationDuration={1200} maxBarSize={120} stackId="a" />
              <Bar dataKey="WD3" fill="#bfc9d1" isAnimationActive={true} animationDuration={1200} maxBarSize={120} stackId="a">
                <LabelList dataKey="total" position="top" style={{ fontWeight: 900, fill: '#fff', fontSize: 18, letterSpacing: 1 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default LyricsMECPage; 