import React from 'react';
import { Box, Typography } from '@mui/material';

interface SectionHeaderProps {
  title: string;
  color?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, color = '#23283B' }) => (
  <Box sx={{ background: color, borderRadius: 2, px: 4, py: 1, display: 'inline-block', mb: 2 }}>
    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1 }}>
      {title}
    </Typography>
  </Box>
);

export default SectionHeader; 