const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve static files from public directory
app.use(express.static('public'));

// Store songs and votes
let songs = [
    { id: 1, name: "Nancy Ajram - Aah W Noss", votes: 0, file: "Nancy Ajram  Aah W Noss.mp3" },
    { id: 2, name: "Amr Diab - Tamally Maak", votes: 0, file: "y2mate.com - Tamally Maak  AmrDiab   Official Music Video  تملى معاك  عمرو دياب.mp3" },
    { id: 3, name: "Mish Masmou7", votes: 0, file: "08. Mish Masmou7.mp3" },
    { id: 4, name: "Jaye 3a Bali", votes: 0, file: "34Jaye 3a Bali.mp3" }
];

let gameState = {
    isVoting: false,
    currentSong: null,
    votingTimeout: null,
    host: null,
    canStart: false
};

let participants = new Map(); // Store connected users
let votes = new Map(); // Store user votes

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected');

    // Handle user joining
    socket.on('joinVoting', (username) => {
        if (username.trim()) {
            // Check maximum player limit
            if (participants.size >= 30) {
                socket.emit('error', 'Room is full (maximum 30 players)');
                return;
            }

            const isNewHost = !gameState.host;
            participants.set(socket.id, { username, isHost: isNewHost });
            if (isNewHost) {
                gameState.host = socket.id;
            }

            // Check if we have enough players to start
            gameState.canStart = participants.size >= 2 && participants.size <= 30;

            // Emit updated participants and game state to all clients
            io.emit('updateParticipants', {
                count: participants.size,
                participants: Array.from(participants.values()),
                canStart: gameState.canStart
            });

            // Send individual host status to the client
            socket.emit('hostStatus', {
                isHost: participants.get(socket.id).isHost
            });
            
            // Send current game state to new participant
            socket.emit('gameState', {
                isVoting: gameState.isVoting,
                currentSong: gameState.currentSong,
                songs: songs,
                canStart: gameState.canStart
            });
        }
    });

    // Handle host starting the game
    socket.on('startGame', () => {
        if (socket.id === gameState.host) {
            if (participants.size >= 2 && participants.size <= 30) {
                startNewVotingRound();
            } else {
                socket.emit('error', 'Need between 2 and 30 players to start');
            }
        }
    });

    // Handle vote
    socket.on('vote', (songId) => {
        if (gameState.isVoting && !votes.has(socket.id)) {
            votes.set(socket.id, songId);
            const song = songs.find(s => s.id === songId);
            if (song) {
                song.votes++;
                io.emit('updateVotes', songs);
                
                // Check if everyone has voted
                if (votes.size === participants.size) {
                    endVotingRound();
                }
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (participants.has(socket.id)) {
            // If host disconnects, assign new host
            if (socket.id === gameState.host) {
                const remainingParticipants = Array.from(participants.keys());
                if (remainingParticipants.length > 0) {
                    gameState.host = remainingParticipants[0];
                    const newHost = participants.get(gameState.host);
                    if (newHost) {
                        newHost.isHost = true;
                    }
                } else {
                    gameState.host = null;
                }
            }
            
            participants.delete(socket.id);
            votes.delete(socket.id);
            
            // Check if we have enough players to start
            gameState.canStart = participants.size >= 2 && participants.size <= 30;

            io.emit('updateParticipants', {
                count: participants.size,
                participants: Array.from(participants.values()),
                canStart: gameState.canStart
            });
        }
    });
});

function startNewVotingRound() {
    gameState.isVoting = true;
    gameState.currentSong = null;
    votes.clear();
    songs.forEach(song => song.votes = 0);
    io.emit('newVotingRound', songs);
}

function endVotingRound() {
    gameState.isVoting = false;
    const winnerSong = songs.reduce((prev, current) => 
        (prev.votes > current.votes) ? prev : current
    );
    gameState.currentSong = winnerSong;
    io.emit('playSong', winnerSong);
    
    // Wait for song duration before starting new round
    setTimeout(() => {
        if (participants.size > 0) {
            startNewVotingRound();
        }
    }, 30000); // Assuming 30 seconds per song, adjust as needed
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
