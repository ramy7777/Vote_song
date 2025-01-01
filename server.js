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
            isVoting: true,
            lastActivity: Date.now(),
            currentTime: 0,
            lastTimeUpdate: 0
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
            session.canStart = session.participants.size >= 2;
            
            // Send session info to the joining player
            socket.emit('sessionJoined', {
                sessionId: activeQuickSession,
                isHost: false
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
                isHost: true
            });
            
            // Update participants list
            io.to(quickSessionId).emit('updateParticipants', {
                participants: Array.from(session.participants.values()),
                canStart: false
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
                    canStart: session.participants.size >= 2
                });
                
                // Clean up empty sessions
                if (session.participants.size === 0) {
                    sessions.delete(currentSessionId);
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
        session.canStart = session.participants.size >= 2 && session.host !== null;
        
        // Emit updated state to all participants in this session
        io.to(currentSessionId).emit('updateParticipants', {
            participants: Array.from(session.participants.values()),
            canStart: session.canStart
        });
        
        // Send session ID back to client
        socket.emit('sessionJoined', {
            sessionId: currentSessionId,
            isHost: session.host === socket.id
        });
        
        updateLastActivity(currentSessionId);
    });

    // Handle game start
    socket.on('startGame', () => {
        if (currentSessionId && isHost(socket.id, currentSessionId)) {
            const session = sessions.get(currentSessionId);
            startNewVotingRound(currentSessionId);
            io.to(currentSessionId).emit('gameState', { isVoting: true });
            updateLastActivity(currentSessionId);
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
});

// Start server
http.listen(PORT, () => {
    console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});
