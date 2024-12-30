# Vote Song

A real-time song voting application where users can join rooms and vote for songs to play next.

## Features
- Real-time voting system
- Host controls for song playback
- Synchronized audio playback across all clients
- Mobile-friendly interface
- Vote sound effects

## Local Development
1. Install dependencies:
```bash
npm install
```

2. Add your songs:
- Place MP3 files in the `public/songs` directory
- Supported formats: .mp3

3. Start the development server:
```bash
npm run dev
```

4. Visit `http://localhost:3000` in your browser

## Deployment to Render.com

### Prerequisites
1. Create a Render.com account
2. Create a new Web Service
3. Connect your GitHub repository

### Setup Instructions
1. Configure the Web Service:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables: None required

2. Songs Management:
   - Local development: Place songs in `public/songs/`
   - Production: Upload songs to the same directory after deployment
   - Note: Songs are not included in git repository

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (default: development)

## Architecture
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Real-time: Socket.IO
- Audio: Web Audio API

## Notes
- Songs are not included in the git repository
- Local and production servers can use different song sets
- Audio synchronization includes network latency compensation
