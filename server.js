const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve static files from public directory
app.use(express.static('public'));

// Store songs and votes
let songs = [
    { id: 1, name: "Nancy Ajram - Aah W Noss", votes: 0, file: "Nancy Ajram  Aah W Noss.mp3" },
    // Add more songs here
];

let participants = new Map(); // Store connected users

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected');

    // Handle user joining
    socket.on('joinVoting', (username) => {
        if (username.trim()) {
            participants.set(socket.id, username);
            io.emit('updateParticipants', {
                count: participants.size,
                participants: Array.from(participants.values())
            });
        }
    });

    // Handle vote
    socket.on('vote', (songId) => {
        const song = songs.find(s => s.id === songId);
        if (song) {
            song.votes++;
            io.emit('updateVotes', songs);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (participants.has(socket.id)) {
            participants.delete(socket.id);
            io.emit('updateParticipants', {
                count: participants.size,
                participants: Array.from(participants.values())
            });
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
