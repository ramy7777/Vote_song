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

// Initial game state
const initialGameState = {
    isVoting: false,
    currentSong: null,
    votingTimeout: null,
    host: null,
    canStart: false
};

let gameState = { ...initialGameState };
let participants = new Map(); // Store connected users
let votes = new Map(); // Store user votes

function resetGameState() {
    // Reset songs votes
    songs.forEach(song => song.votes = 0);
    
    // Reset game state but keep the host
    const currentHost = gameState.host;
    gameState = { ...initialGameState };
    gameState.host = currentHost;
    
    // Clear votes
    votes.clear();
    
    // Clear any existing timeouts
    if (gameState.votingTimeout) {
        clearTimeout(gameState.votingTimeout);
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user joining
    socket.on('joinVoting', (username) => {
        console.log('User joining:', username, 'Socket ID:', socket.id);
        if (username.trim()) {
            // Check maximum player limit
            if (participants.size >= 30) {
                socket.emit('error', 'Room is full (maximum 30 players)');
                return;
            }

            // Only assign as host if there is no current host
            const isNewHost = !gameState.host;
            const participant = { username, isHost: isNewHost };
            participants.set(socket.id, participant);
            
            if (isNewHost) {
                console.log('Assigning new host:', socket.id);
                gameState.host = socket.id;
                // If this is a new host, reset the game state
                resetGameState();
            }

            // Check if we have enough players to start
            gameState.canStart = participants.size >= 2 && participants.size <= 30;
            console.log('Game state:', {
                host: gameState.host,
                currentPlayer: socket.id,
                isHost: participant.isHost,
                canStart: gameState.canStart,
                participants: participants.size
            });

            // Emit updated participants and game state to all clients
            io.emit('updateParticipants', {
                count: participants.size,
                participants: Array.from(participants.values()),
                canStart: gameState.canStart
            });

            // Send individual host status to the client
            socket.emit('hostStatus', {
                isHost: participant.isHost
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
        console.log('Start game requested by:', socket.id);
        console.log('Current host:', gameState.host);
        console.log('Participants:', participants.size);
        console.log('Is host check:', socket.id === gameState.host);
        console.log('Player count check:', participants.size >= 2 && participants.size <= 30);
        
        if (socket.id === gameState.host) {
            if (participants.size >= 2 && participants.size <= 30) {
                console.log('Starting new game...');
                // Reset any existing votes and start new round
                votes.clear();
                songs.forEach(song => song.votes = 0);
                gameState.isVoting = true;
                gameState.currentSong = null;
                
                // Emit game state update before starting new round
                io.emit('gameState', {
                    isVoting: true,
                    currentSong: null,
                    songs: songs,
                    canStart: gameState.canStart
                });
                
                startNewVotingRound();
            } else {
                console.log('Not enough players or too many players');
                socket.emit('error', 'Need between 2 and 30 players to start');
            }
        } else {
            console.log('Non-host tried to start game');
            socket.emit('error', 'Only the host can start the game');
        }
    });

    // Handle host control events
    socket.on('hostControl', (data) => {
        if (isHost(socket.id)) {
            if (typeof data === 'string') {
                // Handle legacy string messages
                io.emit('hostControl', { action: data });
            } else {
                // Handle new format with timestamp
                io.emit('hostControl', data);
            }
        }
    });

    // Handle time updates from host
    socket.on('timeUpdate', (time) => {
        if (socket.id === gameState.host) {
            // Broadcast the current time to all other clients
            socket.broadcast.emit('syncTime', time);
        }
    });

    // Handle voting
    socket.on('vote', (songId) => {
        if (!gameState.isVoting || votes.has(socket.id)) return;
        
        const song = songs.find(s => s.id === songId);
        if (song) {
            votes.set(socket.id, songId);
            song.votes++;
            
            // Broadcast updated songs to all clients
            io.emit('updateVotes', songs);
            
            // If everyone has voted, end the round
            if (votes.size === participants.size) {
                endVotingRound();
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (participants.has(socket.id)) {
            const wasHost = socket.id === gameState.host;
            const participant = participants.get(socket.id);
            participants.delete(socket.id);

            console.log('Disconnect state:', {
                wasHost,
                remainingParticipants: participants.size,
                currentHost: gameState.host
            });

            if (wasHost) {
                // If host disconnects, assign new host if there are remaining participants
                if (participants.size > 0) {
                    const newHostId = participants.keys().next().value;
                    const newHostParticipant = participants.get(newHostId);
                    newHostParticipant.isHost = true;
                    gameState.host = newHostId;
                    
                    console.log('New host assigned:', newHostId);
                    
                    // Notify new host
                    io.to(newHostId).emit('hostStatus', { isHost: true });
                } else {
                    // No participants left, reset game state
                    gameState.host = null;
                    resetGameState();
                }
            }

            // Update can start status
            gameState.canStart = participants.size >= 2 && participants.size <= 30;

            // Notify remaining participants
            io.emit('updateParticipants', {
                count: participants.size,
                participants: Array.from(participants.values()),
                canStart: gameState.canStart
            });

            // Reset game if not enough players
            if (participants.size < 2) {
                resetGameState();
                io.emit('gameState', {
                    isVoting: false,
                    currentSong: null,
                    songs: songs,
                    canStart: false
                });
            }
        }
    });
});

function isHost(socketId) {
    return socketId === gameState.host;
}

function startNewVotingRound() {
    console.log('Starting new voting round');
    gameState.isVoting = true;
    gameState.currentSong = null;
    votes.clear();
    songs.forEach(song => song.votes = 0);
    io.emit('newVotingRound', songs);
}

function endVotingRound() {
    console.log('Ending voting round');
    gameState.isVoting = false;
    const winnerSong = songs.reduce((prev, current) => 
        (prev.votes > current.votes) ? prev : current
    );
    gameState.currentSong = winnerSong;
    io.emit('playSong', winnerSong);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
