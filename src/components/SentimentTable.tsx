import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import SectionHeader from './SectionHeader';

const sentimentColors: Record<string, string> = {
  green: '#4CAF50',
  yellow: '#FFEB3B',
  red: '#F44336',
};

const sentimentOptions = [
  { value: 'green', label: 'Good' },
  { value: 'yellow', label: 'Warning' },
  { value: 'red', label: 'Bad' },
];

const initialData = [
  { month: '2025-02', fine: 'green', finance: 'green', comment: 'OK!' },
  { month: '2025-03', fine: 'green', finance: 'yellow', comment: 'Finance: The late delivery of X lead to extra manual work for us' },
  { month: '2025-04', fine: 'red', finance: 'red', comment: 'The failing deployment of <SomeProject> delayed the MEC timeline' },
  { month: '2025-05', fine: 'green', finance: 'green', comment: 'OK!' },
];

const SentimentTable = () => {
  const [data, setData] = React.useState(initialData);

  const handleChange = (idx: number, persona: 'fine' | 'finance', value: string) => {
    const newData = [...data];
    newData[idx][persona] = value;
    setData(newData);
  };

  return (
    <>
      <SectionHeader title="Sentiment" color="#23283B" />
      <TableContainer component={Paper} sx={{ maxWidth: 700, margin: 'auto', mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ background: '#222' }}>
              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Month</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>FinE</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Finance</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Comment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={row.month}>
                <TableCell>{row.month}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', background: sentimentColors[row.fine], mr: 1, border: '1px solid #888' }} />
                    <Select
                      value={row.fine}
                      onChange={(e: SelectChangeEvent) => handleChange(idx, 'fine', e.target.value)}
                      size="small"
                      sx={{ minWidth: 60 }}
                    >
                      {sentimentOptions.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', background: sentimentColors[row.finance], mr: 1, border: '1px solid #888' }} />
                    <Select
                      value={row.finance}
                      onChange={(e: SelectChangeEvent) => handleChange(idx, 'finance', e.target.value)}
                      size="small"
                      sx={{ minWidth: 60 }}
                    >
                      {sentimentOptions.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                </TableCell>
                <TableCell>{row.comment}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default SentimentTable; 