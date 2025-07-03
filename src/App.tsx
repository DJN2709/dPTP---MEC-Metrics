import React from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Typography, AppBar, Toolbar, Box, Grid, Paper, IconButton, Drawer, List, ListItem, ListItemText } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import MetricCards from './components/MetricCards';
import CalculationStatusesChart from './components/CalculationStatusesChart';
import BackfillRuntimeChart from './components/BackfillRuntimeChart';
import CalculationRuntimeChart from './components/CalculationRuntimeChart';
import DataVolumeCharts from './components/DataVolumeCharts';
import SentimentTable from './components/SentimentTable';
import SecondPage from './components/SecondPage';
import AudiobooksMECPage from './components/AudiobooksMECPage';
import S4CPodcastMECPage from './components/S4CPodcastMECPage';
import LyricsMECPage from './components/LyricsMECPage';
import MECTimelinePage from './components/MECTimelinePage';


const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6a1b9a', // purple accent
    },
    secondary: {
      main: '#42a5f5', // blue accent
    },
    background: {
      default: '#181C23',
      paper: '#23283B',
    },
    text: {
      primary: '#fff',
      secondary: '#bfc9d1',
    },
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: 'Inter, Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif',
    fontWeightBold: 700,
    h4: { fontWeight: 700, color: '#fff' },
    h6: { fontWeight: 600, color: '#fff' },
    body1: { color: '#bfc9d1' },
    body2: { color: '#bfc9d1' },
  },
});

const cardSx = {
  bgcolor: '#181C23', // black background for key metrics
  borderRadius: 3,
  p: { xs: 2, md: 3 },
  boxShadow: 3,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  height: '100%',
};

function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const handleDrawerOpen = () => setDrawerOpen(true);
  const handleDrawerClose = () => setDrawerOpen(false);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
      <AppBar position="static" sx={{
          background: '#181C23', // solid black background
        boxShadow: 'none',
        minHeight: 64,
      }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton edge="start" color="inherit" aria-label="menu" onClick={handleDrawerOpen} sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700, letterSpacing: 1, color: '#fff', fontSize: 36 }}>
            dPTP-MEC Metrics Dashboard
          </Typography>
            </Box>
            <Box component="img" src="/fine_logo.png" alt="Logo" sx={{ height: 80, ml: 2 }} />
        </Toolbar>
      </AppBar>
        <Drawer anchor="left" open={drawerOpen} onClose={handleDrawerClose} PaperProps={{ sx: { bgcolor: '#23283B', color: '#fff' } }}>
          <Box sx={{ width: 250 }} role="presentation" onClick={handleDrawerClose}>
            <List>
              <ListItem button component={Link} to="/mec-timeline">
                <ListItemText primary="MEC Timeline" primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 600 } }} />
              </ListItem>
              <ListItem button component={Link} to="/second">
                <ListItemText primary="Music MEC" primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 600 } }} />
              </ListItem>
              <ListItem button component={Link} to="/audiobooks">
                <ListItemText primary="Audiobooks MEC" primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 600 } }} />
              </ListItem>
              <ListItem button component={Link} to="/lyrics">
                <ListItemText primary="Lyrics MEC" primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 600 } }} />
              </ListItem>
              <ListItem button component={Link} to="/s4c-podcast-mec">
                <ListItemText primary="S4C Podcast MEC" primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 600 } }} />
              </ListItem>

            </List>
          </Box>
        </Drawer>
        <Routes>
          <Route path="/" element={<MECTimelinePage />} />
          <Route path="/second" element={<SecondPage />} />
          <Route path="/audiobooks" element={<AudiobooksMECPage />} />
          <Route path="/lyrics" element={<LyricsMECPage />} />
          <Route path="/s4c-podcast-mec" element={<S4CPodcastMECPage />} />
          <Route path="/mec-timeline" element={<MECTimelinePage />} />

        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 