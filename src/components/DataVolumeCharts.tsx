import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, LabelList } from 'recharts';
import SectionHeader from './SectionHeader';
import { Grid, Box } from '@mui/material';

const data = [
  { month: '2025-02', number_of_cliques: 480000, number_of_ppids: 12000, gcs_size_gb: 10 },
  { month: '2025-03', number_of_cliques: 400000, number_of_ppids: 13000, gcs_size_gb: 9.6 },
  { month: '2025-04', number_of_cliques: 520000, number_of_ppids: 15000, gcs_size_gb: 10.49 },
];

const DataVolumeCharts = () => (
  <>
    <SectionHeader title="Data Volume" color="#23283B" />
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <YAxis tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <Tooltip />
              <Line type="monotone" dataKey="number_of_cliques" stroke="#8e44ec" strokeWidth={3} dot={{ r: 6 }} name="number_of_cliques" />
            </LineChart>
          </ResponsiveContainer>
        </Grid>
        <Grid item xs={12} md={4}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <YAxis tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <Tooltip />
              <Line type="monotone" dataKey="number_of_ppids" stroke="#8e44ec" strokeWidth={3} dot={{ r: 6 }} name="number_of_ppids" />
            </LineChart>
          </ResponsiveContainer>
        </Grid>
        <Grid item xs={12} md={4}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <YAxis tick={{ fontSize: 14, fill: '#fff', fontWeight: 700 }} axisLine={{ stroke: '#fff' }} tickLine={{ stroke: '#fff' }} />
              <Tooltip />
              <Bar dataKey="gcs_size_gb" fill="#8e44ec">
                <LabelList dataKey="gcs_size_gb" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grid>
      </Grid>
    </Box>
  </>
);

export default DataVolumeCharts; 