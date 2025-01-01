const socket = io();

let domElements = {};
let username;
let isHost = false;
let currentSessionId = null;
let hasVoted = false;
let songs = [];
let serverTimeOffset = 0;
let lastSyncTime = 0;
let syncInterval = 100; // Sync every 100ms instead of 1000ms
let networkLatency = 0;
let lastPing = 0;
let audioContextInitialized = false;
let pendingPlay = false;
let participants = new Map(); // Add participants tracking

// Calculate network latency
function updateNetworkLatency() {
    lastPing = Date.now();
    socket.emit('ping');
}

socket.on('pong', () => {
    networkLatency = (Date.now() - lastPing) / 2; // RTT/2 for one-way latency
    console.log('Network latency:', networkLatency, 'ms');
});

// Start regular latency updates
setInterval(updateNetworkLatency, 5000);

// Initialize audio context on first user interaction
function initAudioContext() {
    if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!audioContextInitialized && window.audioContext) {
        window.audioContext.resume().then(() => {
            console.log('AudioContext initialized');
            audioContextInitialized = true;
            if (pendingPlay && domElements.audioPlayer) {
                domElements.audioPlayer.play().catch(console.error);
                pendingPlay = false;
            }
        }).catch(error => {
            console.error('Failed to initialize AudioContext:', error);
        });
    }
}

// Initialize DOM Elements
function initializeDOMElements() {
    domElements = {
        usernameInput: document.getElementById('username'),
        hostSessionInput: document.getElementById('host-session-id'),
        createSessionBtn: document.getElementById('create-session-btn'),
        joinSessionBtn: document.getElementById('join-session-btn'),
        sessionInput: document.getElementById('session-id'),
        sessionDisplay: document.getElementById('session-display'),
        songsContainer: document.getElementById('songs-container'),
        participantCount: document.getElementById('participant-count'),
        votingParticipantCount: document.getElementById('voting-participant-count'),
        participantList: document.getElementById('participant-list'),
        hostControls: document.getElementById('host-controls'),
        startGameBtn: document.getElementById('start-game-btn'),
        currentSongDiv: document.getElementById('current-song'),
        currentSongName: document.getElementById('current-song-name'),
        audioPlayer: document.getElementById('audio-player'),
        muteBtn: document.getElementById('mute-btn'),
        mutedIcon: document.querySelector('.muted'),
        unmutedIcon: document.querySelector('.unmuted'),
        waitingMessage: document.getElementById('waiting-message'),
        stopButton: document.getElementById('stop-button'),
        quickJoinBtn: document.getElementById('quick-join-btn'),
    };

    // Add audio context initialization on user interaction
    document.body.addEventListener('touchstart', initAudioContext, { once: true });
    document.body.addEventListener('click', initAudioContext, { once: true });

    // Quick Join Button
    domElements.quickJoinBtn.addEventListener('click', () => {
        const username = domElements.usernameInput.value.trim();
        if (username) {
            socket.emit('quickJoin', { username });
        }
    });

    // Event Listeners for Session Management
    domElements.createSessionBtn.addEventListener('click', () => {
        const username = domElements.usernameInput.value.trim();
        const customSessionId = domElements.hostSessionInput.value.trim();
        
        if (username) {
            socket.emit('joinVoting', { 
                username, 
                isHostUser: true,
                sessionId: customSessionId || null
            });
            showScreen('waiting-screen');
        }
    });

    domElements.joinSessionBtn.addEventListener('click', () => {
        const username = domElements.usernameInput.value.trim();
        const sessionId = domElements.sessionInput.value.trim();
        if (username && sessionId) {
            socket.emit('joinVoting', { 
                username, 
                isHostUser: false,
                sessionId
            });
            showScreen('waiting-screen');
        }
    });

    // Add start game button listener
    if (domElements.startGameBtn) {
        domElements.startGameBtn.addEventListener('click', () => {
            if (isHost) {
                socket.emit('startGame');
            }
        });
    }

    domElements.muteBtn.addEventListener('click', () => {
        const isMuted = soundManager.toggleMute();
        domElements.mutedIcon.classList.toggle('hidden', !isMuted);
        domElements.unmutedIcon.classList.toggle('hidden', isMuted);
        if (domElements.audioPlayer) {
            domElements.audioPlayer.muted = isMuted;
        }
    });

    if (domElements.stopButton) {
        domElements.stopButton.addEventListener('click', () => {
            if (isHost) {
                socket.emit('hostControl', 'stop');
                domElements.audioPlayer.pause();
                domElements.audioPlayer.currentTime = 0;
                showScreen('voting-screen');
            }
        });
    }

    if (domElements.audioPlayer) {
        domElements.audioPlayer.addEventListener('play', () => {
            if (isHost) {
                socket.emit('hostControl', { action: 'play', time: domElements.audioPlayer.currentTime });
            }
        });

        domElements.audioPlayer.addEventListener('pause', () => {
            if (isHost) {
                socket.emit('hostControl', { action: 'pause', time: domElements.audioPlayer.currentTime });
            }
        });

        // Handle song ended
        domElements.audioPlayer.addEventListener('ended', () => {
            if (isHost) {
                socket.emit('hostControl', { action: 'ended' });
                socket.emit('songEnded');
            }
            hasVoted = false;
            domElements.currentSongDiv.classList.add('hidden');
        });
    }

    // Add stop button handler
    if (domElements.stopButton) {
        domElements.stopButton.addEventListener('click', () => {
            if (isHost) {
                socket.emit('hostControl', { action: 'stop' });
                hasVoted = false;
                if (domElements.audioPlayer) {
                    domElements.audioPlayer.pause();
                    domElements.audioPlayer.currentTime = 0;
                }
                domElements.currentSongDiv.classList.add('hidden');
                showScreen('voting-screen');
            }
        });
    }
}

// Socket Events
socket.on('sessionJoined', (data) => {
    currentSessionId = data.sessionId;
    isHost = data.isHost;
    
    // Update session display
    if (domElements.sessionDisplay) {
        domElements.sessionDisplay.textContent = `Room ID: ${currentSessionId}`;
    }
    
    // Show host controls if host
    if (domElements.hostControls) {
        domElements.hostControls.classList.toggle('hidden', !isHost);
    }
    
    // Show waiting screen
    showScreen('waiting-screen');
});

socket.on('updateParticipants', (data) => {
    if (domElements.participantCount) {
        domElements.participantCount.textContent = data.participants.length;
        domElements.votingParticipantCount.textContent = data.participants.length;
    }

    // Update participants map
    participants.clear();
    data.participants.forEach(participant => {
        participants.set(participant.id, participant);
    });

    // Update participant list
    if (domElements.participantList) {
        domElements.participantList.innerHTML = '';
        data.participants.forEach(participant => {
            const li = document.createElement('li');
            li.textContent = `${participant.username}${participant.isHost ? ' (Host)' : ''}`;
            domElements.participantList.appendChild(li);
        });
    }

    // Update host controls and start button
    if (domElements.hostControls && isHost) {
        domElements.hostControls.classList.remove('hidden');
        if (domElements.startGameBtn) {
            domElements.startGameBtn.disabled = !data.canStart;
            domElements.startGameBtn.title = data.canStart ? 
                'Start the game' : 
                'Need between 2 and 30 players to start';
        }
    }

    // Update waiting message
    if (domElements.waitingMessage) {
        const neededPlayers = data.participants.length < 2 ? 2 - data.participants.length : 0;
        domElements.waitingMessage.textContent = neededPlayers > 0 ?
            `Waiting for ${neededPlayers} more player${neededPlayers > 1 ? 's' : ''}...` :
            'Waiting for host to start the game...';
    }
});

socket.on('hostStatus', (data) => {
    console.log('Received host status:', data);
    isHost = data.isHost;
    if (domElements.hostControls) {
        domElements.hostControls.classList.toggle('hidden', !isHost);
    }
});

socket.on('error', (data) => {
    console.error('Server error:', data.message);
    // You could show this error to the user in a more user-friendly way
});

socket.on('gameState', (state) => {
    console.log('Received game state:', state);
    songs = state.songs; // Update songs when game state is received
    if (state.isVoting) {
        showScreen('voting-screen');
        updateSongsDisplay(songs);
    }
    
    if (state.currentSong) {
        playSong(state.currentSong);
    } else {
        if (domElements.currentSongDiv) {
            domElements.currentSongDiv.classList.add('hidden');
        }
        if (domElements.audioPlayer) {
            domElements.audioPlayer.pause();
            domElements.audioPlayer.currentTime = 0;
        }
    }
});

socket.on('newVotingRound', (songs) => {
    console.log('Received newVotingRound event', songs);
    hasVoted = false;
    // Hide current song if it's showing
    if (domElements.currentSongDiv) {
        domElements.currentSongDiv.classList.add('hidden');
    }
    showScreen('voting-screen');
    updateSongsDisplay(songs);
});

socket.on('updateVotes', (songs) => {
    console.log('Received updated votes:', songs);
    updateSongsDisplay(songs);
});

socket.on('playSong', (song) => {
    playSong(song);
});

socket.on('syncTime', (hostTime) => {
    if (!isHost && domElements.audioPlayer && !domElements.audioPlayer.paused) {
        const currentTime = domElements.audioPlayer.currentTime;
        const latencyCompensatedTime = hostTime + (networkLatency / 1000);
        const drift = Math.abs(currentTime - latencyCompensatedTime);
        
        // If drift is more than 0.2 seconds, sync the time
        if (drift > 0.2) {
            console.log('Syncing time - Host:', hostTime, 'Client:', currentTime, 'Diff:', drift);
            
            // Gradually adjust the playback rate to catch up or slow down
            if (currentTime < latencyCompensatedTime) {
                domElements.audioPlayer.playbackRate = 1.05; // Speed up slightly
                setTimeout(() => {
                    domElements.audioPlayer.playbackRate = 1.0;
                }, 1000);
            } else {
                domElements.audioPlayer.playbackRate = 0.95; // Slow down slightly
                setTimeout(() => {
                    domElements.audioPlayer.playbackRate = 1.0;
                }, 1000);
            }
            
            // If the difference is too large, sync immediately
            if (diff > 1) {
                domElements.audioPlayer.currentTime = hostTime;
            }
        }
    }
});

socket.on('hostControl', (data) => {
    if (!isHost && domElements.audioPlayer) {
        console.log('Client: Received host control:', data);
        
        if (data.action === 'stop') {
            console.log('Client: Stopping playback');
            domElements.audioPlayer.pause();
            domElements.audioPlayer.currentTime = 0;
            domElements.currentSongDiv.classList.add('hidden');
            showScreen('voting-screen');
            // Reset any pending play state
            pendingPlay = false;
            // Remove all event listeners and recreate audio player
            const newAudioPlayer = document.createElement('audio');
            newAudioPlayer.id = 'audioPlayer';
            domElements.audioPlayer.replaceWith(newAudioPlayer);
            domElements.audioPlayer = newAudioPlayer;
            return; // Don't process any other actions after stop
        }
        
        if (data.action === 'play') {
            if (!audioContextInitialized) {
                pendingPlay = true;
                showPlayButton();
                return;
            }
            
            // Compensate for network latency
            if (data.time) {
                const serverTime = data.time;
                const latencyCompensatedTime = serverTime + (networkLatency / 1000);
                domElements.audioPlayer.currentTime = latencyCompensatedTime;
            }

            const playPromise = domElements.audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Playback failed:', error);
                    if (error.name === 'NotAllowedError') {
                        showPlayButton();
                    }
                });
            }
        } else if (data.action === 'pause') {
            domElements.audioPlayer.pause();
            if (data.time) {
                domElements.audioPlayer.currentTime = data.time;
            }
        } else if (data.action === 'ended') {
            console.log('Client: Song ended');
            domElements.audioPlayer.pause();
            domElements.audioPlayer.currentTime = 0;
            domElements.currentSongDiv.classList.add('hidden');
            showScreen('voting-screen');
            pendingPlay = false;
            // Remove all event listeners and recreate audio player
            const newAudioPlayer = document.createElement('audio');
            newAudioPlayer.id = 'audioPlayer';
            domElements.audioPlayer.replaceWith(newAudioPlayer);
            domElements.audioPlayer = newAudioPlayer;
        } else if (data.action === 'buffer') {
            console.log('Host is buffering...');
            domElements.audioPlayer.pause();
        } else if (data.action === 'ready') {
            console.log('Host is ready to play');
        }
    }
});

socket.on('timeUpdate', (serverTime) => {
    if (!isHost && domElements.audioPlayer) {
        const currentTime = domElements.audioPlayer.currentTime;
        const latencyCompensatedTime = serverTime + (networkLatency / 1000);
        const drift = Math.abs(currentTime - latencyCompensatedTime);
        
        // If drift is more than 200ms, sync the time
        if (drift > 0.2) {
            console.log('Correcting drift:', drift, 'seconds');
            // Smoothly adjust playback rate to catch up/slow down
            if (currentTime < latencyCompensatedTime) {
                domElements.audioPlayer.playbackRate = 1.1; // Speed up slightly
                setTimeout(() => {
                    domElements.audioPlayer.playbackRate = 1.0;
                }, 1000);
            } else {
                domElements.audioPlayer.playbackRate = 0.9; // Slow down slightly
                setTimeout(() => {
                    domElements.audioPlayer.playbackRate = 1.0;
                }, 1000);
            }
        }
    }
});

socket.on('songControl', (action) => {
    if (!isHost && domElements.audioPlayer) {
        if (action === 'play') {
            domElements.audioPlayer.play();
        } else if (action === 'pause') {
            domElements.audioPlayer.pause();
        } else if (action === 'stop') {
            domElements.audioPlayer.pause();
            domElements.audioPlayer.currentTime = 0;
            domElements.currentSongDiv.classList.add('hidden');
        }
    }
});

socket.on('resetVoting', (songs) => {
    console.log('Resetting voting state');
    hasVoted = false;
    updateSongsDisplay(songs);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    if (reason === 'io server disconnect') {
        // Server disconnected us, redirect to join screen
        showScreen('join-screen');
        hasVoted = false;
        isHost = false;
        domElements.currentSongDiv?.classList.add('hidden');
        if (domElements.audioPlayer) {
            domElements.audioPlayer.pause();
            domElements.audioPlayer.currentTime = 0;
        }
    }
});

socket.on('startVoting', () => {
    console.log('New voting round started');
    hasVoted = false;
    if (domElements.audioPlayer) {
        domElements.audioPlayer.pause();
        domElements.audioPlayer.currentTime = 0;
    }
    if (domElements.currentSongDiv) {
        domElements.currentSongDiv.classList.add('hidden');
    }
    showScreen('voting-screen');
});

// Helper Functions
function showScreen(screenId) {
    console.log('Showing screen:', screenId);
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
    } else {
        console.error('Screen not found:', screenId);
    }
}

function voteSong(songId) {
    if (!hasVoted) {
        socket.emit('vote', { songId });  
        hasVoted = true;
    }
}

function updateSongsDisplay(songs) {
    if (!domElements.songsContainer || !songs) return;

    domElements.songsContainer.innerHTML = '';
    songs.forEach(song => {
        const songCard = document.createElement('div');
        songCard.className = 'song-card' + (song.votes > 0 ? ' voted' : '') + (hasVoted ? ' disabled' : '');
        songCard.setAttribute('data-id', song.id);
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'song-name';
        nameDiv.textContent = song.name;
        
        const votesDiv = document.createElement('div');
        votesDiv.className = 'vote-count';
        votesDiv.textContent = `${song.votes} vote${song.votes !== 1 ? 's' : ''}`;

        songCard.appendChild(nameDiv);
        songCard.appendChild(votesDiv);

        // Add voters list if there are any voters
        if (song.voterNames && song.voterNames.length > 0) {
            const votersDiv = document.createElement('div');
            votersDiv.className = 'voters-list';
            votersDiv.textContent = `Voted by: ${song.voterNames.join(', ')}`;
            songCard.appendChild(votersDiv);
        }
        
        if (!hasVoted) {
            songCard.addEventListener('click', () => {
                voteSong(song.id);
            });
        }
        
        domElements.songsContainer.appendChild(songCard);
    });
}

function playSong(song) {
    // Re-initialize audio player if needed
    if (!domElements.audioPlayer) {
        domElements.audioPlayer = document.getElementById('audioPlayer');
        if (!domElements.audioPlayer) {
            console.error('Audio player not found!');
            return;
        }
    }

    if (!domElements.currentSongDiv) return;
    
    domElements.currentSongDiv.classList.remove('hidden');
    domElements.currentSongName.textContent = song.name;
    
    // Create a new audio context if it doesn't exist
    if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Set the source
    domElements.audioPlayer.src = `/songs/${song.file}`;
    domElements.audioPlayer.preload = 'auto';
    
    if (isHost) {
        // Enable controls for host
        domElements.audioPlayer.controls = true;
        
        // Add event listeners for host controls
        domElements.audioPlayer.addEventListener('play', () => {
            console.log('Host: Play');
            socket.emit('hostControl', { 
                action: 'play',
                time: domElements.audioPlayer.currentTime,
                timestamp: Date.now()
            });
        });

        // More frequent time updates
        let lastUpdate = 0;
        domElements.audioPlayer.addEventListener('timeupdate', () => {
            const now = Date.now();
            if (now - lastUpdate > syncInterval) {
                socket.emit('timeUpdate', {
                    time: domElements.audioPlayer.currentTime,
                    timestamp: now
                });
                lastUpdate = now;
            }
        });

        domElements.audioPlayer.addEventListener('ended', () => {
            console.log('Host: Song ended naturally');
            socket.emit('hostControl', { action: 'ended' });
            socket.emit('songEnded');
        });

        // Add stop button handler
        if (domElements.stopButton) {
            domElements.stopButton.classList.remove('hidden');
            domElements.stopButton.onclick = () => {
                console.log('Host: Stop button clicked');
                socket.emit('hostControl', { action: 'stop' });
                domElements.audioPlayer.pause();
                domElements.audioPlayer.currentTime = 0;
                showScreen('voting-screen');
            };
        }

        // Start playing for host
        domElements.audioPlayer.play().catch(console.error);
    } else {
        // For non-host clients
        domElements.audioPlayer.controls = false;
        if (domElements.stopButton) {
            domElements.stopButton.classList.add('hidden');
        }
        // Start playing for clients
        domElements.audioPlayer.play().catch(error => {
            console.error('Client playback failed:', error);
            if (error.name === 'NotAllowedError') {
                showPlayButton();
            }
        });
    }

    // Add buffering event listeners
    domElements.audioPlayer.addEventListener('waiting', () => {
        console.log('Audio buffering...');
        if (isHost) {
            socket.emit('hostControl', { action: 'buffer' });
        }
    });

    domElements.audioPlayer.addEventListener('canplay', () => {
        console.log('Audio ready to play');
        if (isHost) {
            socket.emit('hostControl', { action: 'ready' });
        }
    });
}

// Function to show a play button when needed
function showPlayButton() {
    // Remove any existing play buttons
    const existingButton = document.querySelector('.play-interaction-button');
    if (existingButton) {
        existingButton.remove();
    }

    const button = document.createElement('button');
    button.className = 'play-interaction-button';
    button.textContent = 'Tap to Play';
    button.addEventListener('click', () => {
        if (domElements.audioPlayer) {
            const playPromise = domElements.audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    button.remove();
                    audioContextInitialized = true;
                    pendingPlay = false;
                }).catch(error => {
                    console.error('Playback still failed:', error);
                });
            }
        }
    });

    document.body.appendChild(button);
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    soundManager.preloadAll();
});
