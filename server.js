const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

console.log('Starting server...');

// Constants
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;
const VOTING_DURATION = 30000; // 30 seconds

// Serve static files from public directory
const publicPath = path.join(__dirname, 'public');
console.log('Serving static files from:', publicPath);
app.use(express.static(publicPath));

// Root route
app.get('/', (req, res) => {
    console.log('Received request for root path');
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('Sending file:', indexPath);
    res.sendFile(indexPath);
});

// Log all requests
app.use((req, res, next) => {
    console.log('Request:', req.method, req.url);
    next();
});

// Store songs and votes
let songs = [
    { id: 1, name: "Nancy Ajram - Aah W Noss", votes: 0, file: "Nancy Ajram  Aah W Noss.mp3", duration: 203 },
    { id: 2, name: "Amr Diab - Tamally Maak", votes: 0, file: "Amr Diab - Tamally Maak.mp3", duration: 258 },
    { id: 3, name: "Elissa - Aa Bali Habibi", votes: 0, file: "Elissa - Aa Bali Habibi.mp3", duration: 267 },
    { id: 4, name: "Fadel Shaker - Ya Ghayeb", votes: 0, file: "Fadel Shaker - Ya Ghayeb.mp3", duration: 300 },
    { id: 5, name: "Fairuz - Kifak Inta", votes: 0, file: "Fairuz - Kifak Inta.mp3", duration: 234 },
    { id: 6, name: "George Wassouf - Kalam El Nas", votes: 0, file: "George Wassouf - Kalam El Nas.mp3", duration: 321 },
    { id: 7, name: "Kadim Al Sahir - Zidini Ishqan", votes: 0, file: "Kadim Al Sahir - Zidini Ishqan.mp3", duration: 289 },
    { id: 8, name: "Majida El Roumi - Kalimat", votes: 0, file: "Majida El Roumi - Kalimat.mp3", duration: 276 },
    { id: 9, name: "Melhem Zein - Git Al Habayib", votes: 0, file: "Melhem Zein - Git Al Habayib.mp3", duration: 245 },
    { id: 10, name: "Wael Kfoury - Omry Kello", votes: 0, file: "Wael Kfoury - Omry Kello.mp3", duration: 312 }
];

let participants = new Map(); // Store connected users
let isVotingOpen = false;
let currentlyPlaying = null;
let votingTimeout = null;
let gameStarted = false;
let votedUsers = new Set(); // Track who has voted in current round

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected');

    // Handle user joining
    socket.on('joinVoting', (username) => {
        if (username.trim()) {
            // Check if we're at max capacity
            if (participants.size >= MAX_PLAYERS) {
                socket.emit('joinError', 'Room is full (max 30 players)');
                return;
            }

            participants.set(socket.id, username);
            
            // Send current game state to new participant
            socket.emit('gameState', {
                isVotingOpen,
                songs,
                currentlyPlaying,
                participantCount: participants.size,
                minPlayers: MIN_PLAYERS,
                maxPlayers: MAX_PLAYERS,
                gameStarted
            });

            // Broadcast updated participant count
            io.emit('updateParticipants', {
                count: participants.size,
                participants: Array.from(participants.values())
            });

            // If we have minimum players and game hasn't started, start it
            if (participants.size >= MIN_PLAYERS && !gameStarted) {
                startNewVotingRound();
                gameStarted = true;
            }
        }
    });

    // Handle vote
    socket.on('vote', (songId) => {
        if (isVotingOpen && !votedUsers.has(socket.id)) {
            const song = songs.find(s => s.id === songId);
            if (song) {
                song.votes++;
                votedUsers.add(socket.id);
                io.emit('updateVotes', songs);

                // Check if everyone has voted
                if (votedUsers.size === participants.size) {
                    // End voting early if everyone has voted
                    clearTimeout(votingTimeout);
                    endVotingAndPlaySong();
                }
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (participants.has(socket.id)) {
            participants.delete(socket.id);
            votedUsers.delete(socket.id);
            
            const participantCount = participants.size;
            io.emit('updateParticipants', {
                count: participantCount,
                participants: Array.from(participants.values())
            });

            // If we drop below minimum players, pause the game
            if (participantCount < MIN_PLAYERS && gameStarted) {
                gameStarted = false;
                isVotingOpen = false;
                if (votingTimeout) {
                    clearTimeout(votingTimeout);
                }
                io.emit('gamePaused', 'Waiting for more players to join (minimum 2 players)');
            }
        }
    });
});

function startNewVotingRound() {
    // Reset votes
    songs.forEach(song => song.votes = 0);
    votedUsers.clear();
    isVotingOpen = true;
    currentlyPlaying = null;
    
    // Emit voting start
    io.emit('votingStart', {
        songs,
        votingDuration: VOTING_DURATION / 1000
    });
    
    // Set timeout for voting period
    votingTimeout = setTimeout(() => endVotingAndPlaySong(), VOTING_DURATION);
}

function endVotingAndPlaySong() {
    isVotingOpen = false;
    
    // Find song with most votes
    const winningSound = songs.reduce((prev, current) => 
        (prev.votes > current.votes) ? prev : current
    );
    
    currentlyPlaying = winningSound;
    
    // Emit to all clients to play the winning song
    io.emit('playSong', winningSound);
    
    // Schedule next voting round after song finishes
    setTimeout(() => {
        if (participants.size >= MIN_PLAYERS) {
            startNewVotingRound();
        } else {
            gameStarted = false;
            io.emit('gamePaused', 'Waiting for more players to join (minimum 2 players)');
        }
    }, (winningSound.duration * 1000) + 2000); // Add 2 seconds buffer between songs
}

// Start server
const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
