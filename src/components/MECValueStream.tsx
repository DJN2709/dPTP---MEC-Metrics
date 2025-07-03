import React from 'react';
import { Typography, Paper, Box } from '@mui/material';

const MECValueStream: React.FC = () => {
  // Placeholder stages and tasks for the MEC process
  const valueStreamData = {
    stages: [
      {
        name: 'Pre-Close Activities',
        tasks: ['Gather financial data', 'Review pre-close checklist'],
        duration: '2 days',
      },
      {
        name: 'Journal Entries & Reconciliations',
        tasks: ['Post accruals & deferrals', 'Reconcile bank accounts', 'Reconcile intercompany transactions'],
        duration: '3 days',
      },
      {
        name: 'Consolidation & Review',
        tasks: ['Consolidate financial statements', 'Perform variance analysis', 'Management review'],
        duration: '2 days',
      },
      {
        name: 'Reporting & Closing',
        tasks: ['Generate financial reports', 'Finalize close documentation', 'Close general ledger'],
        duration: '1 day',
      },
    ],
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Month-End Close (MEC) Value Stream
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'row', overflowX: 'auto', gap: 2 }}>
        {valueStreamData.stages.map((stage, index) => (
          <Paper key={index} elevation={2} sx={{ p: 2, minWidth: 250 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {stage.name}
            </Typography>
            <Typography variant="subtitle2" gutterBottom>
              Duration: {stage.duration}
            </Typography>
            <Typography variant="body2" component="div">
              Tasks:
              <ul>
                {stage.tasks.map((task, taskIndex) => (
                  <li key={taskIndex}>{task}</li>
                ))}
              </ul>
            </Typography>
          </Paper>
        ))}
      </Box>
    </Paper>
  );
};

export default MECValueStream; 