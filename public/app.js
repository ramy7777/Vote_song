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
let firstPlay = true;  // Track first play of session
let participants = new Map(); // Add participants tracking
let wakeLock = null;
let audioContext;

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
setInterval(updateNetworkLatency, 2000);

// Initialize audio context on first user interaction
function initAudioContext() {
    if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        window.audioContext.resume();
    }
}

// Request wake lock
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock is active');
            
            // Re-request wake lock if page becomes visible again
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock was released');
                requestWakeLock(); // Re-request
            });
        }
    } catch (err) {
        console.error('Wake Lock error:', err);
    }
}

// Release wake lock
function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release()
            .then(() => {
                wakeLock = null;
                console.log('Wake Lock released');
            });
    }
}

// Handle visibility change
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

// Function to show a play button when needed
function showPlayButton() {
    // Only show play button for first play
    if (!firstPlay) return;

    // Remove any existing play buttons
    const existingButton = document.querySelector('.play-interaction-button');
    if (existingButton) {
        existingButton.remove();
    }

    const button = document.createElement('button');
    button.className = 'play-interaction-button';
    button.textContent = 'Tap to Start Audio';
    button.addEventListener('click', () => {
        if (!window.audioContext) {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        window.audioContext.resume().then(() => {
            console.log('AudioContext initialized');
            audioContextInitialized = true;
            firstPlay = false;  // Mark first play as done
            button.remove();
            
            if (domElements.audioPlayer && pendingPlay) {
                domElements.audioPlayer.play();
                pendingPlay = false;
            }
        });
    });

    document.body.appendChild(button);
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
        waitingMessage: document.getElementById('waiting-message'),
        stopButton: document.getElementById('stop-button'),
        quickJoinBtn: document.getElementById('quick-join-btn'),
        controlButtons: document.querySelector('.control-buttons')
    };

    // Add sync button
    if (domElements.controlButtons) {
        const syncButton = document.createElement('button');
        syncButton.textContent = '🔄';
        syncButton.className = 'control-btn';
        syncButton.title = 'Sync with host';
        syncButton.id = 'sync-button';
        syncButton.style.backgroundColor = '#007bff';
        domElements.controlButtons.appendChild(syncButton);

        // Handle sync with host
        syncButton.addEventListener('click', function() {
            if (isHost) {
                alert('You are the host!');
                return;
            }
            
            // Forward playback by 225ms on every sync click
            if (domElements.audioPlayer) {
                const currentTime = domElements.audioPlayer.currentTime;
                const newTime = currentTime + 0.225; // Add 225ms
                domElements.audioPlayer.currentTime = newTime;
                console.log(`Sync: Forwarded playback by 225ms from ${currentTime.toFixed(3)} to ${newTime.toFixed(3)}`);
            }
        });
    }

    // Initialize audio context immediately
    initAudioContext();

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

    // Add mute button functionality
    if (domElements.muteBtn) {
        domElements.muteBtn.addEventListener('click', () => {
            if (domElements.audioPlayer) {
                domElements.audioPlayer.muted = !domElements.audioPlayer.muted;
                const icon = domElements.muteBtn.querySelector('i');
                icon.className = domElements.audioPlayer.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
            }
        });
    }

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

    // Add audio context initialization on first user interaction
    if (firstPlay) {
        document.body.addEventListener('touchstart', () => {
            if (firstPlay) showPlayButton();
        }, { once: true });
        document.body.addEventListener('click', () => {
            if (firstPlay) showPlayButton();
        }, { once: true });
    }
}

// Socket Events
socket.on('sessionJoined', (data) => {
    console.log('Session joined:', data);
    currentSessionId = data.sessionId;
    isHost = data.isHost;
    
    // Update session display
    if (domElements.sessionDisplay) {
        domElements.sessionDisplay.textContent = `Room ID: ${currentSessionId}`;
    }
    
    // Show host controls if host
    if (domElements.hostControls) {
        domElements.hostControls.classList.toggle('hidden', !isHost);
        if (isHost) {
            // Enable start button immediately for host
            domElements.startGameBtn.disabled = false;
            domElements.startGameBtn.title = 'Click to start the game';
            domElements.waitingMessage.textContent = 'You can start the game now!';
        }
    }
    
    // Always show waiting screen first for new sessions
    showScreen('waiting-screen');
    
    // If game has started, show the current game state
    if (data.gameStarted) {
        if (data.isVoting) {
            showScreen('voting-screen');
            // Request current votes
            socket.emit('requestVotes');
        } else if (data.currentSong) {
            showScreen('voting-screen');  // Contains the player
            playSong(data.currentSong);
        }
    }
});

socket.on('updateParticipants', (data) => {
    console.log('Update participants:', data);
    const { participants, canStart } = data;
    
    // Update participant count
    const participantCount = participants.length;
    domElements.participantCount.textContent = participantCount;
    domElements.votingParticipantCount.textContent = participantCount;
    
    // Update participant list
    domElements.participantList.innerHTML = '';
    participants.forEach(participant => {
        const div = document.createElement('div');
        div.className = 'participant';
        div.textContent = `${participant.username}${participant.isHost ? ' (Host)' : ''}`;
        domElements.participantList.appendChild(div);
    });
    
    // Update waiting message and start button
    if (isHost) {
        console.log('Host controls update:', { canStart, isHost });
        domElements.hostControls.classList.remove('hidden');
        domElements.startGameBtn.disabled = !canStart;  // Use canStart from server
        domElements.waitingMessage.textContent = canStart ? 
            'You can start the game now!' : 
            'Waiting for host privileges...';
    } else {
        domElements.hostControls.classList.add('hidden');
        domElements.waitingMessage.textContent = 'Waiting for host to start...';
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

socket.on('gameState', (data) => {
    console.log('Received game state:', data);
    songs = data.songs; // Update songs when game state is received
    if (data.isVoting) {
        showScreen('voting-screen');
        updateSongsDisplay(songs);
    }
    
    if (data.currentSong) {
        showScreen('voting-screen');  // Show voting screen as it contains the player
        playSong(data.currentSong);
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
    showScreen('voting-screen');  // Show voting screen as it contains the player
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
            // Compensate for network latency
            if (data.time) {
                const serverTime = data.time;
                const latencyCompensatedTime = serverTime + (networkLatency / 1000);
                domElements.audioPlayer.currentTime = latencyCompensatedTime;
            }

            if (firstPlay) {
                pendingPlay = true;
                showPlayButton();
            } else {
                domElements.audioPlayer.play();
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
            if (firstPlay) {
                pendingPlay = true;
                showPlayButton();
            } else {
                domElements.audioPlayer.play();
            }
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

socket.on('hostLeft', () => {
    alert('Host has left the session.');
    window.location.reload();
});

// Handle getTime request from clients
socket.on('getTime', (callback) => {
    if (isHost && domElements.audioPlayer) {
        callback(domElements.audioPlayer.currentTime);
    }
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
    if (!song) return;
    
    // Request wake lock when playing
    requestWakeLock();
    
    // Set audio attributes for background playback
    if (domElements.audioPlayer) {
        domElements.audioPlayer.setAttribute('playsinline', '');
        domElements.audioPlayer.setAttribute('webkit-playsinline', '');
        domElements.audioPlayer.setAttribute('preload', 'auto');
        
        // Enable background audio playback
        try {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        } catch (e) {
            console.error('Error resuming audio context:', e);
        }
        
        // Re-initialize audio player if needed
        if (!domElements.audioPlayer) {
            domElements.audioPlayer = document.getElementById('audioPlayer');
            if (!domElements.audioPlayer) {
                console.error('Audio player not found!');
                return;
            }
        }

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

            // Start playing for host
            if (firstPlay) {
                pendingPlay = true;
                showPlayButton();
            } else {
                domElements.audioPlayer.play();
            }
        } else {
            // For non-host clients
            domElements.audioPlayer.controls = false;
            if (domElements.stopButton) {
                domElements.stopButton.classList.add('hidden');
            }
            
            // Start playing for clients
            if (firstPlay) {
                pendingPlay = true;
                showPlayButton();
            } else {
                domElements.audioPlayer.play();
            }
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
        
        // Add ended event listener
        domElements.audioPlayer.addEventListener('ended', () => {
            releaseWakeLock();  // Release wake lock when song ends
        });
    }
}

// Update stop button handler
if (domElements.stopButton) {
    domElements.stopButton.addEventListener('click', () => {
        if (isHost) {
            socket.emit('hostControl', { action: 'stop' });
            hasVoted = false;
            if (domElements.audioPlayer) {
                domElements.audioPlayer.pause();
                domElements.audioPlayer.currentTime = 0;
                releaseWakeLock();  // Release wake lock when stopping
            }
            domElements.currentSongDiv.classList.add('hidden');
            showScreen('voting-screen');
        }
    });
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    soundManager.preloadAll();
});
