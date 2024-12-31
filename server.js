const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const compression = require('compression');

// Enable gzip compression
app.use(compression());

// Environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Serve static files from public directory
app.use(express.static('public'));

// Initialize songs array with the songs from the directory
let songs = [
    { id: 1, name: 'All I Want For Christmas Is You - Mariah Carey', file: '(Mariah Carey)-All I Want For Christmas Is You(1) (2).mp3', votes: 0 },
    { id: 2, name: 'Waiyaah', file: '01 - Waiyaah.mp3', votes: 0 },
    { id: 3, name: 'Rajee Yetamar Lebnan', file: '01 Rajee Yetamar Lebnan.mp3', votes: 0 },
    { id: 4, name: 'Titanium - David Guetta ft. Sia', file: '01. Titanium.mp3', votes: 0 },
    { id: 5, name: 'Hotel California - Eagles', file: '01. hotel california.mp3', votes: 0 },
    { id: 6, name: 'Come As You Are - Nirvana', file: '02 - Nirvana - Come As You Are - EMG - www.elitemusic.org.mp3', votes: 0 },
    { id: 7, name: 'No Woman No Cry - Bob Marley', file: '02 - No woman no cry.mp3', votes: 0 },
    { id: 8, name: 'Sexy And I Know It - LMFAO', file: '02. Sexy And I Know It.mp3', votes: 0 },
    { id: 9, name: 'Bring Me to Life - Evanescence', file: '03 - Bring Me to Life.mp3', votes: 0 },
    { id: 10, name: 'Losing My Religion - R.E.M.', file: '03 - R.E.M. - Losing My Religion.mp3', votes: 0 },
    { id: 11, name: 'Zombie - The Cranberries', file: '03 - The Cranberries - Zombie.mp3', votes: 0 },
    { id: 12, name: 'Another Brick In The Wall - Pink Floyd', file: '03 Another Brick In The Wall, [Part One].mp3', votes: 0 },
    { id: 13, name: 'I Believe I Can Fly - R. Kelly', file: '03-R.Kelly-I-Believe-I-Can-Fly.mp3', votes: 0 },
    { id: 14, name: 'I Know You Want Me (Calle Ocho)', file: '03. I Know You Want Me (Calle Ocho).mp3', votes: 0 },
    { id: 15, name: 'Allah Ala Hobbak Inta', file: '04 - Allah Ala Hobbak Inta.mp3', votes: 0 },
    { id: 16, name: 'The Unforgiven - Metallica', file: '04 The Unforgiven.mp3', votes: 0 },
    { id: 17, name: 'Beauty And The Beast - Celine Dion & Peabo Bryson', file: '05 - Beauty And The Beast (With Peabo Bryson).mp3', votes: 0 },
    { id: 18, name: "It's All Coming Back To Me Now - Celine Dion", file: "07 - It's All Coming Back To Me Now (Radio Edit).mp3", votes: 0 },
    { id: 19, name: 'Iris - Goo Goo Dolls', file: '07- Goo Goo Dolls - Iris.mp3', votes: 0 },
    { id: 20, name: 'Besame Mucho - Andrea Bocelli', file: '07-andrea_bocelli-besame_mucho.mp3', votes: 0 },
    { id: 21, name: 'Nothing Else Matters - Metallica', file: '08 Nothing Else Matters.mp3', votes: 0 },
    { id: 22, name: 'Smoke on the Water - Deep Purple', file: '08 Smoke on the Water [25th Anniversary Remaster].mp3', votes: 0 },
    { id: 23, name: "I'm Your Angel - Celine Dion & R. Kelly", file: "09 - I'm Your Angel (With R.Kelly).mp3", votes: 0 },
    { id: 24, name: 'Time to Say Goodbye - Andrea Bocelli', file: '09-andrea_bocelli-time_to_say_goodbye-(con_te_partiro).mp3', votes: 0 },
    { id: 25, name: 'Kiss from a Rose - Seal', file: '10-seal-kiss_from_a_rose_(bonus_track).mp3', votes: 0 },
    { id: 26, name: 'Vivo Por Lei - Andrea Bocelli & Giorgia', file: '12-andrea_bocelli_duet_w_giorgia-vivo_por_lei.mp3', votes: 0 },
    { id: 27, name: 'Un Break My Heart - Toni Braxton', file: '12._Un_Break_My_Heart_Soul_Hex_Anthem_Vocal_Mix_.mp3', votes: 0 },
    { id: 28, name: 'Hey You - Pink Floyd', file: '14 Hey You.mp3', votes: 0 },
    { id: 29, name: 'Kiss From A Rose - Seal', file: '15 - Seal - Kiss Form A Rose.mp3', votes: 0 },
    { id: 30, name: 'We Will Rock You - Queen', file: '20 - Queen - WE will rock you.mp3', votes: 0 },
    { id: 31, name: '2om Fot Nam', file: '2om-Fot-Nam.mp3', votes: 0 },
    { id: 32, name: "Knockin' on Heaven's Door - Guns N' Roses", file: "7-Guns-n_-Roses-Knocking-on-Heaven_s-Door.mp3", votes: 0 },
    { id: 33, name: 'Amazing - Aerosmith', file: 'Aerosmith - Amazing.mp3', votes: 0 },
    { id: 34, name: "I Don't Want to Miss a Thing - Aerosmith", file: 'Aerosmith - I dont want to miss a thing.mp3', votes: 0 },
    { id: 35, name: 'Naughty Girl - Beyoncé', file: 'Beyonce-Naughty-Girl.mp3', votes: 0 },
    { id: 36, name: 'Always - Bon Jovi', file: 'Bon Jovi - Always.mp3', votes: 0 },
    { id: 37, name: 'Fly Away (Unplugged)', file: 'Fly Away (unplugged).mp3', votes: 0 },
    { id: 38, name: 'Killing Me Softly - Fugees', file: 'Fugees - Killing me softly.mp3', votes: 0 },
    { id: 39, name: 'On The Floor - Jennifer Lopez ft. Pitbull', file: 'Jennifer Lopez Ft. Pitbull - On The Floor (FULL VERSION).mp3', votes: 0 },
    { id: 40, name: 'Anytime You Need a Friend - Mariah Carey', file: 'Mariah Carey - Anytime you need a friend.mp3', votes: 0 },
    { id: 41, name: 'Hero - Mariah Carey', file: 'Mariah Carey - Hero.mp3', votes: 0 },
    { id: 42, name: 'My All - Mariah Carey', file: 'Mariah Carey - My All.mp3', votes: 0 },
    { id: 43, name: 'Without You - Mariah Carey', file: 'Mariah Carey - Without you.mp3', votes: 0 },
    { id: 44, name: "I Can't Live - Mariah Carey", file: 'Mariah-Carey-I-Cant-Live.mp3', votes: 0 },
    { id: 45, name: 'All I Want For Christmas Is You - Mariah Carey', file: 'Mariah-Carey_-All-I-Want-For-Christmas-Is-You_1_-_2_.mp3', votes: 0 },
    { id: 46, name: 'Aah W Noss - Nancy Ajram', file: 'Nancy Ajram  Aah W Noss.mp3', votes: 0 },
    { id: 47, name: 'Inta Eh - Nancy Ajram', file: 'Nancy Ajram - Inta Eh.mp3', votes: 0 },
    { id: 48, name: 'Ya Tabtab - Nancy Ajram', file: 'Nancy Ajram - Ya Tabtab .mp3', votes: 0 },
    { id: 49, name: 'Return To Innocence - Enigma', file: 'Return To Innocence (Radio Edit).mp3', votes: 0 },
    { id: 50, name: 'Spending My Time - Roxette', file: 'Roxette-Spending My Time.mp3', votes: 0 },
    { id: 51, name: 'Holiday (Acoustica) - Scorpions', file: 'Scorpions_-_Holiday_(acoustica_Lisboa)_-_[Music961.com].mp3', votes: 0 },
    { id: 52, name: 'Still Loving You (Acoustica) - Scorpions', file: 'Scorpions_-_Still_Loving_You_(acoustica_Lisboa)_-_[Music961.com].mp3', votes: 0 },
    { id: 53, name: 'Only When I Sleep - The Corrs', file: 'The Corrs - Unplugged - 01 - Only When I Sleep.mp3', votes: 0 },
    { id: 54, name: 'Bitter Sweet Symphony - The Verve', file: 'The Verve - Bitter sweet symphony .mp3', votes: 0 },
    { id: 55, name: 'Flowers - Miley Cyrus', file: '[YT2mp3.info] - Miley Cyrus - Flowers (Official Video) (320kbps).mp3', votes: 0 },
    { id: 56, name: 'Wish You Were Here - Pink Floyd', file: 'wish you were here.mp3', votes: 0 },
    { id: 57, name: 'Bad Liar - Imagine Dragons', file: 'y2mate.com - Imagine Dragons  Bad Liar.mp3', votes: 0 },
    { id: 58, name: 'Believer - Imagine Dragons', file: 'y2mate.com - Imagine Dragons  Believer.mp3', votes: 0 },
    { id: 59, name: 'Thunder - Imagine Dragons', file: 'y2mate.com - Imagine Dragons  Thunder.mp3', votes: 0 },
    { id: 60, name: 'Whatever It Takes - Imagine Dragons', file: 'y2mate.com - Imagine Dragons  Whatever It Takes.mp3', votes: 0 },
    { id: 61, name: 'Tamally Maak - Amr Diab', file: 'y2mate.com - Tamally Maak  AmrDiab   Official Music Video  تملى معاك  عمرو دياب.mp3', votes: 0 },
    { id: 62, name: 'Thunder (Lyrics) - Imagine Dragons', file: 'yt1s.com - Imagine Dragons  Thunder Lyrics.mp3', votes: 0 }
].map(song => ({ ...song, voters: [] }));

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
    // Reset songs votes and voters
    songs.forEach(song => {
        song.votes = 0;
        song.voters = [];
    });
    
    // Reset game state but keep the host
    const currentHost = gameState.host;
    gameState = { ...initialGameState, host: currentHost };
    
    // Reset hasVoted for all participants
    for (let [id, participant] of participants) {
        participant.hasVoted = false;
    }
    
    // Notify clients with reset songs
    io.emit('resetVoting', songs);
}

function startNewVotingRound() {
    // Reset votes for all songs
    songs.forEach(song => {
        song.votes = 0;
        song.voters = [];
    });
    
    // Reset hasVoted for all participants
    for (let [id, participant] of participants) {
        participant.hasVoted = false;
    }
    
    // Explicitly tell clients to reset voting state with songs
    io.emit('resetVoting', songs);
    
    console.log('New voting round started');
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
            const participant = { username, isHost: isNewHost, hasVoted: false };
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
                songs.forEach(song => song.voters = []);
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
            console.log('Host control:', data);
            
            if (typeof data === 'string') {
                // Handle legacy string messages
                io.emit('hostControl', { action: data });
                if (data === 'stop' || data === 'ended') {
                    console.log('Song ended or stopped by host, starting new voting round');
                    startNewVotingRound();
                }
            } else {
                // Handle new format with timestamp and time
                io.emit('hostControl', {
                    ...data,
                    serverTime: Date.now()
                });
                if (data.action === 'stop' || data.action === 'ended') {
                    console.log('Song ended or stopped by host, starting new voting round');
                    startNewVotingRound();
                }
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
        const participant = participants.get(socket.id);
        if (!participant || participant.hasVoted || !gameState.isVoting) return;

        participant.hasVoted = true;
        const song = songs.find(s => s.id === songId);
        if (song) {
            song.votes++;
            song.voters = song.voters || [];
            song.voters.push(participant.username);
            io.emit('updateVotes', songs);

            // Check if all participants have voted
            const allVoted = Array.from(participants.values()).every(p => p.hasVoted);
            if (allVoted) {
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
    
    // Reset votes for all songs
    songs.forEach(song => {
        song.votes = 0;
        song.voters = [];
    });
    
    // Reset hasVoted for all participants
    for (let [id, participant] of participants) {
        participant.hasVoted = false;
    }
    
    // Emit the updated game state to all clients
    io.emit('gameState', {
        isVoting: true,
        currentSong: null,
        songs: songs,
        canStart: gameState.canStart
    });
    
    // Explicitly tell clients to reset voting state with songs
    io.emit('resetVoting', songs);
    
    console.log('New voting round started');
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

// Start server
http.listen(PORT, () => {
    console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});
