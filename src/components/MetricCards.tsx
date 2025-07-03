import React from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SectionHeader from './SectionHeader';

const metrics = [
  {
    label: 'AVG Daily Spend',
    value: '$6,429',
    change: -34.2,
  },
  {
    label: 'royalty-reporting',
    value: '$3,636',
    change: -5.7,
  },
  {
    label: 'royalty-platform',
    value: '$2,143',
    change: -34.2,
  },
  {
    label: 'ab-royalty-volantis',
    value: '$15',
    change: 81.6,
  },
];

const getChangeColor = (change: number) => (change < 0 ? 'green' : 'red');
const getArrow = (change: number) => (change < 0 ? <ArrowDropDownIcon fontSize="large" /> : <ArrowDropUpIcon fontSize="large" />);

const cardStyle = {
  borderRadius: 10,
  p: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  flex: 1,
  boxShadow: 3,
  background: '#23283B',
};

const MetricCards = () => (
  <>
    <SectionHeader title="Key Metrics" color="#23283B" />
    <Grid container spacing={4} sx={{ mb: 4, alignItems: 'stretch', width: '100%' }}>
      {metrics.map((metric, idx) => (
        <Grid item xs={12} sm={6} md={3} key={idx} sx={{ display: 'flex', alignItems: 'stretch' }}>
          <Paper elevation={3} sx={cardStyle}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, fontSize: 20, textAlign: 'center', mb: 1 }}>{metric.label}</Typography>
            <Typography variant="h2" gutterBottom sx={{ fontWeight: 900, fontSize: 40, textAlign: 'center' }}>{metric.value}</Typography>
            <Box sx={{ color: getChangeColor(metric.change), fontWeight: 'bold', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {getArrow(metric.change)}
              {Math.abs(metric.change)}%
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  </>
);

export default MetricCards; 