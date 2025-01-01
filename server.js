const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const compression = require('compression');
const axios = require('axios');

// Enable gzip compression
app.use(compression());

// Environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Serve static files from public directory
app.use(express.static('public'));

// GitHub repository configuration
const GITHUB_USER = process.env.GITHUB_USER || 'ramy7777';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Vote_song';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Function to fetch song list from GitHub
async function fetchSongsFromGitHub() {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'vote-song-app'
    };
    
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    // Fetch the latest release
    const releaseResponse = await axios.get(
      `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/latest`,
      { headers }
    );

    const release = releaseResponse.data;
    
    // Map the assets to our song format
    const songs = release.assets.map((asset, index) => ({
      id: index + 1,
      name: asset.name.replace('.mp3', ''),
      url: asset.browser_download_url,
      votes: 0,
      voters: []
    }));

    return songs;
  } catch (error) {
    console.error('Error fetching songs from GitHub:', error.message);
    return [];
  }
}

// Initialize songs array
let songs = [];

// Update songs list every hour
setInterval(async () => {
  try {
    const newSongs = await fetchSongsFromGitHub();
    if (newSongs.length > 0) {
      songs = newSongs;
      io.emit('songsUpdated', songs);
      console.log('Songs list updated from GitHub');
    }
  } catch (error) {
    console.error('Error updating songs:', error);
  }
}, 60 * 60 * 1000);

// Initial song fetch
fetchSongsFromGitHub().then(newSongs => {
  if (newSongs.length > 0) {
    songs = newSongs;
    console.log('Initial songs loaded from GitHub');
  }
});

// Sessions management
const sessions = new Map();

// Generate a random session ID if none provided
const generateSessionId = () => Math.random().toString(36).substring(2, 8);

// Get or create session with optional custom ID
const getOrCreateSession = (sessionId) => {
  // If no sessionId provided, generate one
  const finalSessionId = sessionId || generateSessionId();
  
  // Check if session exists
  if (!sessions.has(finalSessionId)) {
    sessions.set(finalSessionId, {
      id: finalSessionId,
      host: null,
      participants: new Map(),
      songs: songs.map(song => ({ ...song, votes: 0, voters: [] })),
      isVoting: false,
      lastActivity: Date.now(),
      currentTime: 0,
      lastTimeUpdate: 0,
      currentSong: null,
      gameStarted: false  // Track if game has started
    });
  }
  return sessions.get(finalSessionId);
};

// Update last activity for a session
const updateLastActivity = (sessionId) => {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
  }
};

// Handle session inactivity
const handleSessionInactivity = (sessionId) => {
  const session = sessions.get(sessionId);
  if (session && Date.now() - session.lastActivity > 5 * 60 * 1000) {
    resetSessionState(sessionId);
    io.to(sessionId).emit('sessionReset');
  }
};

// Reset session state
const resetSessionState = (sessionId) => {
  const session = sessions.get(sessionId);
  if (session) {
    session.isVoting = false;
    session.currentSong = null;
    session.votes.clear();
    session.songs = songs.map(song => ({ ...song, votes: 0, voters: [] }));
  }
};

// Check if user is host for a session
const isHost = (socketId, sessionId) => {
  const session = sessions.get(sessionId);
  return session && session.host === socketId;
};

// Start new voting round for a session
const startNewVotingRound = (sessionId) => {
  const session = sessions.get(sessionId);
  if (session) {
    // Reset all song votes and voters
    session.songs.forEach(song => {
      song.votes = 0;
      song.voters = [];
      song.voterNames = [];
    });
    
    session.isVoting = true;
    
    // Create songs array with empty voter information
    const songsWithVoters = session.songs.map(s => ({
      ...s,
      voterNames: []
    }));
    
    io.to(sessionId).emit('startVoting', songsWithVoters);
    io.to(sessionId).emit('updateVotes', songsWithVoters);
  }
};

// End voting round for a session
const endVotingRound = (sessionId) => {
  const session = sessions.get(sessionId);
  if (session) {
    session.isVoting = false;
    io.to(sessionId).emit('votingEnded');
  }
};

let activeQuickSession = null; // Track the active quick session

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  let currentSessionId = null;

  // Handle ping for latency calculation
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Handle quick join
  socket.on('quickJoin', ({ username }) => {
    if (activeQuickSession && sessions.has(activeQuickSession)) {
      // Join existing quick session as player
      const session = sessions.get(activeQuickSession);
      currentSessionId = activeQuickSession;
      
      // Add as non-host participant
      session.participants.set(socket.id, {
        id: socket.id,
        username,
        isHost: false
      });
      
      // Join the socket room
      socket.join(activeQuickSession);
      
      // Update session state
      session.canStart = session.participants.size >= 1;
      
      // Send session info to the joining player
      socket.emit('sessionJoined', {
        sessionId: activeQuickSession,
        isHost: false,
        isVoting: session.isVoting,
        currentSong: session.currentSong,
        gameStarted: session.gameStarted,
        isNewSession: false  // Flag to skip waiting screen for joiners
      });
      
      // Emit updated state to all participants
      io.to(activeQuickSession).emit('updateParticipants', {
        participants: Array.from(session.participants.values()),
        canStart: session.canStart
      });
      
      updateLastActivity(activeQuickSession);
    } else {
      // Create new quick session as host
      const quickSessionId = Math.random().toString(36).substring(2, 5);
      activeQuickSession = quickSessionId;
      currentSessionId = quickSessionId;
      
      // Create session and set up as host
      const session = getOrCreateSession(quickSessionId);
      session.host = socket.id;
      session.participants.set(socket.id, {
        id: socket.id,
        username,
        isHost: true
      });
      
      // Join the socket room
      socket.join(quickSessionId);
      
      // Send session info to host
      socket.emit('sessionJoined', {
        sessionId: quickSessionId,
        isHost: true,
        isVoting: session.isVoting,
        currentSong: session.currentSong,
        gameStarted: session.gameStarted,
        isNewSession: true  // Flag to show waiting screen for new sessions
      });
      
      // Update participants list
      io.to(quickSessionId).emit('updateParticipants', {
        participants: Array.from(session.participants.values()),
        canStart: true
      });
      
      updateLastActivity(quickSessionId);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      if (session) {
        // Remove from participants
        session.participants.delete(socket.id);
        
        // If this was the host of a quick session, clear it
        if (session.host === socket.id && currentSessionId === activeQuickSession) {
          activeQuickSession = null;
        }
        
        // Update remaining participants
        io.to(currentSessionId).emit('updateParticipants', {
          participants: Array.from(session.participants.values()),
          canStart: session.participants.size >= 1
        });
        
        // Clean up empty sessions
        if (session.participants.size === 0) {
          sessions.delete(currentSessionId);
        } else {
          // Update can start status for remaining participants
          io.to(currentSessionId).emit('updateParticipants', {
            participants: Array.from(session.participants.values()),
            canStart: session.participants.size >= 1 && session.host !== null
          });
        }
      }
    }
  });

  // Handle user joining
  socket.on('joinVoting', ({ username, isHostUser, sessionId }) => {
    // Validate session ID if provided for joining
    if (!isHostUser && sessionId && !sessions.has(sessionId)) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }
    
    // For hosts, validate custom session ID if provided
    if (isHostUser && sessionId) {
      if (sessions.has(sessionId)) {
        socket.emit('error', { message: 'Session ID already exists' });
        return;
      }
      if (sessionId.length < 1) {
        socket.emit('error', { message: 'Session ID must be at least 1 character long' });
        return;
      }
    }
    
    currentSessionId = sessionId || generateSessionId();
    const session = getOrCreateSession(currentSessionId);
    
    // Join the socket room for this session
    socket.join(currentSessionId);
    
    // Update session state
    session.participants.set(socket.id, {
      id: socket.id,
      username,
      isHost: isHostUser && !session.host
    });
    
    // Set host if none exists and user requested host
    if (isHostUser && !session.host) {
      session.host = socket.id;
    }
    
    // Update can start condition
    session.canStart = session.participants.size >= 1 && session.host !== null;
    
    // Emit updated state to all participants in this session
    io.to(currentSessionId).emit('updateParticipants', {
      participants: Array.from(session.participants.values()),
      canStart: session.canStart
    });
    
    // Send session ID back to client
    socket.emit('sessionJoined', {
      sessionId: currentSessionId,
      isHost: session.host === socket.id,
      isVoting: session.isVoting,
      currentSong: session.currentSong,
      gameStarted: session.gameStarted,
      isNewSession: false  // Flag to skip waiting screen for joiners
    });

    // If game is already in progress, sync the new participant
    if (session.isVoting) {
      // Send current voting state and show voting screen
      socket.emit('gameState', { isVoting: true });
      // Send current songs with votes
      const songsWithVoters = session.songs.map(s => ({
        ...s,
        voterNames: s.voters.map(voterId => {
          const voter = session.participants.get(voterId);
          return voter ? voter.username : 'Unknown';
        })
      }));
      socket.emit('startVoting', songsWithVoters);
      socket.emit('updateVotes', songsWithVoters);
    } else if (session.currentSong) {
      // If a song is currently playing, sync the new participant
      socket.emit('gameState', { isVoting: false });
      socket.emit('playSong', session.currentSong);
    }
    
    updateLastActivity(currentSessionId);
  });

  // Handle game start
  socket.on('startGame', () => {
    if (currentSessionId && isHost(socket.id, currentSessionId)) {
      const session = sessions.get(currentSessionId);
      if (session && session.participants.size >= 1) {
        session.gameStarted = true;  // Mark game as started
        startNewVotingRound(currentSessionId);
        io.to(currentSessionId).emit('gameState', { isVoting: true });
        updateLastActivity(currentSessionId);
      }
    }
  });

  // Handle voting
  socket.on('vote', ({ songId }) => {
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      if (session && session.isVoting) {
        const song = session.songs.find(s => s.id === songId);
        const participant = session.participants.get(socket.id);
        
        if (song && participant && !song.voters.includes(socket.id)) {
          song.votes++;
          song.voters.push(socket.id);
          
          // Create a songs array with voter information
          const songsWithVoters = session.songs.map(s => ({
            ...s,
            voterNames: s.voters.map(voterId => {
              const voter = session.participants.get(voterId);
              return voter ? voter.username : 'Unknown';
            })
          }));
          
          // Emit updated songs to all participants in the session
          io.to(currentSessionId).emit('updateVotes', songsWithVoters);
          
          // Check if all participants have voted
          const uniqueVoters = new Set(session.songs.flatMap(s => s.voters)).size;
          
          if (uniqueVoters === session.participants.size) {
            // Find the winning song
            const winnerSong = session.songs.reduce((prev, current) => 
              (prev.votes > current.votes) ? prev : current
            );
            
            // End voting and play the winning song
            session.isVoting = false;
            session.currentSong = winnerSong;  // Track current song
            io.to(currentSessionId).emit('playSong', winnerSong);
          }
        }
      }
      updateLastActivity(currentSessionId);
    }
  });

  // Handle time synchronization
  socket.on('timeUpdate', (data) => {
    if (currentSessionId && isHost(socket.id, currentSessionId)) {
      const session = sessions.get(currentSessionId);
      if (session) {
        session.currentTime = data.time;
        session.lastTimeUpdate = data.timestamp;
        // Broadcast time update to all clients except host
        socket.to(currentSessionId).emit('timeUpdate', data.time);
      }
    }
  });

  // Handle host audio control
  socket.on('hostControl', (data) => {
    if (currentSessionId && isHost(socket.id, currentSessionId)) {
      const session = sessions.get(currentSessionId);
      
      if (data.action === 'stop') {
        // Immediately notify clients to stop
        socket.to(currentSessionId).emit('hostControl', { action: 'stop' });
        session.currentSong = null;  // Clear current song
        // Wait a bit before starting new voting round to ensure stop is processed
        setTimeout(() => {
          startNewVotingRound(currentSessionId);
        }, 500);
        updateLastActivity(currentSessionId);
        return;
      }
      
      if (data.action === 'buffer') {
        // Notify clients about buffering
        socket.to(currentSessionId).emit('hostControl', { action: 'pause' });
      } else if (data.action === 'ready') {
        // Notify clients that buffering is complete
        socket.to(currentSessionId).emit('hostControl', { 
          action: 'play',
          time: session.currentTime
        });
      } else if (data.action === 'ended') {
        socket.to(currentSessionId).emit('hostControl', { action: 'ended' });
        // Wait a bit before starting new voting round
        setTimeout(() => {
          startNewVotingRound(currentSessionId);
        }, 500);
      } else {
        // Forward other control messages to clients
        socket.to(currentSessionId).emit('hostControl', data);
      }
      
      updateLastActivity(currentSessionId);
    }
  });

  // Handle song ended
  socket.on('songEnded', () => {
    if (currentSessionId && isHost(socket.id, currentSessionId)) {
      startNewVotingRound(currentSessionId);
    }
  });

  // Handle vote request from late joiners
  socket.on('requestVotes', () => {
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      if (session && session.isVoting) {
        const songsWithVoters = session.songs.map(s => ({
          ...s,
          voterNames: s.voters.map(voterId => {
            const voter = session.participants.get(voterId);
            return voter ? voter.username : 'Unknown';
          })
        }));
        socket.emit('updateVotes', songsWithVoters);
      }
    }
  });
});

// Start server
http.listen(PORT, () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});
