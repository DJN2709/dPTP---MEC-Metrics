import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import SectionHeader from './SectionHeader';

function formatDuration(minutes: number | null) {
  if (minutes == null) return '--';
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
}

const COLORS = {
  music: '#A05CF7',
  audiobooks: '#42a5f5',
  s4c: '#ff7300',
  lyrics: '#00e676',
};

const MEC_NAMES = {
  music: 'Music MEC',
  audiobooks: 'Audiobooks MEC',
  s4c: 'S4C Podcast MEC',
  lyrics: 'Lyrics MEC',
};

const MECTimelinePage = () => {
  const [music, setMusic] = useState<any[]>([]);
  const [audiobooks, setAudiobooks] = useState<any[]>([]);
  const [s4c, setS4c] = useState<any[]>([]);
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('http://localhost:4000/api/mec-highlevel').then(res => res.json()),
      fetch('http://localhost:4000/api/audiobooks-mec-highlevel').then(res => res.json()),
      fetch('http://localhost:4000/api/s4c-podcast-mec-highlevel').then(res => res.json()),
      fetch('http://localhost:4000/api/lyrics-mec-highlevel').then(res => res.json()),
    ]).then(([musicData, audiobooksData, s4cData, lyricsData]) => {
      setMusic(musicData);
      setAudiobooks(audiobooksData);
      setS4c(s4cData);
      setLyrics(lyricsData);
      setLoading(false);
    }).catch(() => {
      setError('Failed to fetch one or more MEC timelines');
      setLoading(false);
    });
  }, []);

  // Merge all months
  const allMonths = Array.from(new Set([
    ...music.map(d => d.month),
    ...audiobooks.map(d => d.month),
    ...s4c.map(d => d.month),
    ...lyrics.map(d => d.month),
  ]));
  // Sort months chronologically
  function monthYearToDate(monthYear: string) {
    const [month, year] = monthYear.split(' ');
    const monthIndex = [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ].indexOf(month);
    return new Date(Number(year), monthIndex);
  }
  const sortedMonths = allMonths.sort((a, b) => monthYearToDate(a).getTime() - monthYearToDate(b).getTime());

  // Only show months from June 2024 onward
  const firstMonthIdx = sortedMonths.findIndex(m => m === 'June 2024');
  const filteredMonths = firstMonthIdx !== -1 ? sortedMonths.slice(firstMonthIdx) : sortedMonths;

  // Build chart data
  const chartData = filteredMonths.map(month => ({
    month,
    music: music.find(d => d.month === month)?.durationMinutes ? (music.find(d => d.month === month).durationMinutes / 60).toFixed(1) : null,
    audiobooks: audiobooks.find(d => d.month === month)?.durationMinutes ? (audiobooks.find(d => d.month === month).durationMinutes / 60).toFixed(1) : null,
    s4c: s4c.find(d => d.month === month)?.durationMinutes ? (s4c.find(d => d.month === month).durationMinutes / 60).toFixed(1) : null,
    lyrics: lyrics.find(d => d.month === month)?.durationMinutes ? (lyrics.find(d => d.month === month).durationMinutes / 60).toFixed(1) : null,
  }));

  return (
    <Box sx={{
      p: { xs: 2, md: 4 },
      minHeight: '100vh',
      background: '#181C23',
      fontFamily: 'Inter, Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif',
    }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
        MEC Timeline
      </Typography>
      <Box sx={{
        maxWidth: 1800,
        mx: 'auto',
        p: { xs: 2, md: 4 },
        borderRadius: 4,
        background: '#23283B',
        mt: 4,
        boxShadow: '0 4px 32px #0008',
      }}>
        <SectionHeader title="High-level duration comparison (Line Chart)" color="#23283B" />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress color="secondary" />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <ResponsiveContainer width="100%" height={700}>
            <LineChart data={chartData} margin={{ top: 50, right: 60, left: 30, bottom: 60 }}>
              <XAxis dataKey="month" angle={-30} textAnchor="end" interval={0} height={90} tick={{ fontSize: 18, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <YAxis
                label={{ value: 'Duration (hours)', angle: -90, position: 'insideLeft', fontSize: 20, fill: '#fff', fontWeight: 700 }}
                tick={{ fontSize: 18, fill: '#fff', fontWeight: 700 }}
                allowDecimals={true}
                axisLine={{ stroke: '#fff' }}
                tickLine={{ stroke: '#fff' }}
                domain={[0, 200]}
              />
              <Tooltip
                formatter={(value) => value == null ? '--' : `${value}h`}
                labelStyle={{ fontWeight: 700, color: '#fff', background: '#23283B' }}
                contentStyle={{ borderRadius: 10, boxShadow: '0 4px 16px #0002', background: '#23283B', border: '1px solid #A05CF7', color: '#fff' }}
                itemStyle={{ fontWeight: 700 }}
                wrapperStyle={{ color: '#fff' }}
              />
              <Legend verticalAlign="bottom" align="left" height={90} iconType="rect" wrapperStyle={{ paddingTop: 40, fontSize: 20 }} />
              <Line type="monotone" dataKey="music" name={MEC_NAMES.music} stroke={COLORS.music} strokeWidth={4} dot={{ r: 5, fill: COLORS.music }} />
              <Line type="monotone" dataKey="audiobooks" name={MEC_NAMES.audiobooks} stroke={COLORS.audiobooks} strokeWidth={4} dot={{ r: 5, fill: COLORS.audiobooks }} />
              <Line type="monotone" dataKey="s4c" name={MEC_NAMES.s4c} stroke={COLORS.s4c} strokeWidth={4} dot={{ r: 5, fill: COLORS.s4c }} />
              <Line type="monotone" dataKey="lyrics" name={MEC_NAMES.lyrics} stroke={COLORS.lyrics} strokeWidth={4} dot={{ r: 5, fill: COLORS.lyrics }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default MECTimelinePage; 