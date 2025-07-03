# dPTP MEC Metrics Dashboard

A comprehensive dashboard for tracking MEC (Monthly Execution Cycle) metrics across different verticals including Music, Lyrics, Audiobooks, and Podcast.

## Features

### 📊 Multiple Vertical Dashboards
- **Music MEC**: Track music processing workflows and durations
- **Lyrics MEC**: Monitor lyrics processing with complex workflow logic
- **Audiobooks MEC**: Follow audiobook production timelines with ABP prioritization
- **Podcast MEC**: S4C podcast production metrics with extended timeline

### 📈 Visualization Components
- **High-level Duration Charts**: Line charts showing overall completion times
- **Duration by Task Charts**: Stacked bar charts breaking down workflow steps
- **Timeline Comparison**: Multi-vertical timeline comparison view
- **Interactive Charts**: Built with Recharts for responsive data visualization

### 🔍 Advanced Detection Logic
- **Flexible Keyword Matching**: Supports both "Music" and "Music:" formats
- **WD3 EOD Updates**: Special handling for Kevin Shea's WD3 EOD update format
- **Multi-section Message Parsing**: Intelligent parsing of complex Slack messages
- **ABP Priority System**: Audiobooks use ABP MEC UPDATE with fallback to regular MEC Update

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for modern UI components
- **Recharts** for data visualization
- **React Router** for navigation

### Backend
- **Node.js** with Express.js
- **Slack Web API** for data integration
- **Real-time data processing** with intelligent filtering

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Slack API credentials

### Setup

1. **Clone the repository**
   ```bash
   git clone https://ghe.spotify.net/dejank/dPTP-MEC-Metrics.git
   cd dPTP-MEC-Metrics
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Copy the example environment file and configure your tokens:
   ```bash
   cp env.example .env
   ```
   Then edit `.env` with your actual Slack API tokens:
   ```env
   SLACK_BOT_TOKEN=xoxb-your-actual-slack-bot-token
   SLACK_USER_TOKEN=xoxp-your-actual-slack-user-token
   PORT=4000
   ```

4. **Start the development servers**
   
   **Backend (Terminal 1):**
   ```bash
   node server.js
   ```
   
   **Frontend (Terminal 2):**
   ```bash
   npm start
   ```

5. **Access the dashboard**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

## API Endpoints

### High-level Duration APIs
- `GET /api/mec-highlevel` - Legacy music data (Jan 2024 - May 2025)
- `GET /api/music-mec-highlevel` - New music data (June 2025+)
- `GET /api/lyrics-mec-highlevel` - Lyrics completion data
- `GET /api/audiobooks-mec-highlevel` - Audiobooks completion data
- `GET /api/s4c-podcast-mec-highlevel` - Podcast completion data

### Steps Timeline APIs
- `GET /api/mec-steps-timeline` - Legacy music workflow steps
- `GET /api/music-mec-steps-timeline` - New music workflow steps
- `GET /api/lyrics-mec-steps-timeline` - Lyrics workflow breakdown
- `GET /api/audiobooks-mec-steps-timeline` - Audiobooks workflow breakdown

## Data Flow Architecture

### Channel Transition Logic
- **Jan 2024 - May 2025**: Separate dedicated channels per vertical
- **June 2025+**: Unified channel (CB0CY1YBH) with keyword filtering
- **Podcast Exception**: Continues using dedicated channel (C05N1FVJ6TD)

### Workflow Steps
1. **MEC Update**: Workflow initiation signal
2. **Backfill**: Data preparation phase
3. **WD1**: First working day processing
4. **WD2**: Second working day processing  
5. **WD3**: Final working day processing
6. **Booked**: Completion confirmation

### Special Logic

#### Lyrics Workflow
- **Smart MEC Update Selection**: Prioritizes current month (1st-7th) vs previous month
- **Sequential Workflow**: Backfill → WD1 → WD2 → WD3 → Booked
- **WD3 EOD Support**: Handles Kevin Shea's "WD3 EOD update" format

#### Audiobooks Priority
- **ABP MEC UPDATE**: Primary detection for audiobooks
- **Fallback Logic**: Uses regular MEC Update if ABP not found
- **Month-specific Validation**: Ensures booked messages match target month

## Development

### Project Structure
```
├── src/
│   ├── components/          # React components
│   │   ├── AudiobooksMECPage.tsx
│   │   ├── LyricsMECPage.tsx
│   │   ├── SecondPage.tsx   # Music MEC
│   │   ├── S4CPodcastMECPage.tsx
│   │   └── MECTimelinePage.tsx
│   ├── App.tsx             # Main application
│   └── index.tsx           # Entry point
├── public/                 # Static assets
├── server.js              # Express backend
├── package.json           # Dependencies
└── README.md              # Documentation
```

### Key Functions
- `extractMusicHighLevelTimeline()` - Music completion tracking
- `extractLyricsStepsTimeline()` - Complex lyrics workflow logic
- `extractAudiobooksHighLevelTimeline()` - ABP priority system
- `extractS4CPodcastHighLevelTimeline()` - Extended podcast timeline

## Deployment

### Production Build
```bash
npm run build
```

### Production Server
```bash
chmod +x start-prod.sh
./start-prod.sh
```

## Troubleshooting

### Common Issues

1. **Server Crashes**: Check Slack API rate limits and token validity
2. **Missing Data**: Verify channel access permissions
3. **Date Parsing**: Ensure UTC timezone consistency
4. **Memory Issues**: Monitor large message processing

### Debug Files
The application generates debug files for troubleshooting:
- `debug_music.txt` - Music processing logs
- `debug_lyrics.txt` - Lyrics processing logs
- `debug_highlevel.txt` - High-level processing logs

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary to Spotify and intended for internal use only.

## Support

For issues and questions, please contact the dPTP team or create an issue in this repository.
