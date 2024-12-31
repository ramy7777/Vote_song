const socket = io();

let domElements = {};
let username;
let isHost = false;
let hasVoted = false;
let audioContextInitialized = false;
let pendingPlay = false;
let serverTimeOffset = 0;

// Initialize audio context on first user interaction
function initAudioContext() {
    if (!audioContextInitialized && window.audioContext) {
        window.audioContext.resume().then(() => {
            console.log('AudioContext initialized');
            audioContextInitialized = true;
            if (pendingPlay && domElements.audioPlayer) {
                domElements.audioPlayer.play().catch(console.error);
                pendingPlay = false;
            }
        });
    }
}

// Initialize DOM Elements
function initializeDOMElements() {
    domElements = {
        usernameInput: document.getElementById('username'),
        joinButton: document.getElementById('join-btn'),
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
        stopButton: document.getElementById('stop-button')
    };

    // Add audio context initialization on user interaction
    document.body.addEventListener('touchstart', initAudioContext, { once: true });
    document.body.addEventListener('click', initAudioContext, { once: true });

    // Event Listeners
    domElements.joinButton.addEventListener('click', () => {
        username = domElements.usernameInput.value.trim();
        if (username) {
            socket.emit('joinVoting', username);
            showScreen('waiting-screen');
        }
    });

    domElements.startGameBtn.addEventListener('click', () => {
        console.log('Start button clicked, isHost:', isHost);
        if (isHost) {
            console.log('Emitting startGame event');
            socket.emit('startGame');
        }
    });

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
    }
}

// Socket Events
socket.on('updateParticipants', (data) => {
    if (domElements.participantCount) {
        domElements.participantCount.textContent = data.count;
        domElements.votingParticipantCount.textContent = data.count;
        
        // Update participant list
        domElements.participantList.innerHTML = '';
        data.participants.forEach(participant => {
            const div = document.createElement('div');
            div.textContent = participant.username + (participant.isHost ? ' (Host)' : '');
            domElements.participantList.appendChild(div);
        });

        // Update start button state if host
        if (isHost && domElements.startGameBtn) {
            console.log('Updating start button state, canStart:', data.canStart);
            domElements.startGameBtn.disabled = !data.canStart;
            domElements.startGameBtn.title = data.canStart ? 
                'Start the game' : 
                'Need between 2 and 30 players to start';
        }

        // Update waiting message
        if (domElements.waitingMessage) {
            const neededPlayers = data.count < 2 ? 2 - data.count : 0;
            domElements.waitingMessage.textContent = neededPlayers > 0 ?
                `Waiting for ${neededPlayers} more player${neededPlayers > 1 ? 's' : ''}...` :
                'Waiting for host to start the game...';
        }
    }
});

socket.on('hostStatus', (data) => {
    console.log('Received host status:', data);
    isHost = data.isHost;
    if (domElements.hostControls) {
        domElements.hostControls.classList.toggle('hidden', !isHost);
    }
});

socket.on('error', (message) => {
    console.log('Received error:', message);
    alert(message);
});

socket.on('gameState', (state) => {
    console.log('Received game state:', state);
    
    if (state.isVoting) {
        showScreen('voting-screen');
        if (state.songs) {
            hasVoted = false;
            updateSongsDisplay(state.songs);
        }
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
    updateSongsDisplay(songs);
});

socket.on('playSong', (song) => {
    playSong(song);
});

socket.on('syncTime', (hostTime) => {
    if (!isHost && domElements.audioPlayer && !domElements.audioPlayer.paused) {
        const currentTime = domElements.audioPlayer.currentTime;
        const diff = Math.abs(hostTime - currentTime);
        
        // Only sync if difference is more than 0.2 seconds
        if (diff > 0.2) {
            console.log('Syncing time - Host:', hostTime, 'Client:', currentTime, 'Diff:', diff);
            
            // Gradually adjust the playback rate to catch up or slow down
            if (currentTime < hostTime) {
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
        
        if (data.action === 'play') {
            if (!audioContextInitialized) {
                pendingPlay = true;
                showPlayButton();
                return;
            }
            
            // Set initial time if provided
            if (data.time) {
                domElements.audioPlayer.currentTime = data.time;
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
        } else if (data.action === 'stop') {
            domElements.audioPlayer.pause();
            domElements.audioPlayer.currentTime = 0;
            showScreen('voting-screen');
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

socket.on('resetVoting', () => {
    console.log('Resetting voting state');
    hasVoted = false;
    updateSongsDisplay(songs);
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

function updateSongsDisplay(songs) {
    if (!domElements.songsContainer) return;

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
        votesDiv.textContent = `${song.votes} votes`;

        // Add voters list if there are any voters
        if (song.voters && song.voters.length > 0) {
            const votersDiv = document.createElement('div');
            votersDiv.className = 'voters-list';
            votersDiv.textContent = `Voted by: ${song.voters.join(', ')}`;
            songCard.appendChild(nameDiv);
            songCard.appendChild(votesDiv);
            songCard.appendChild(votersDiv);
        } else {
            songCard.appendChild(nameDiv);
            songCard.appendChild(votesDiv);
        }
        
        if (!hasVoted) {
            songCard.addEventListener('click', () => {
                voteSong(song.id);
                songCard.classList.add('voted');
            });
        }
        
        domElements.songsContainer.appendChild(songCard);
    });
}

function voteSong(songId) {
    if (!hasVoted) {
        socket.emit('vote', songId);
        hasVoted = true;
        const songCard = document.querySelector(`.song-card[data-id="${songId}"]`);
        if (songCard) {
            songCard.classList.add('voted');
        }
    }
}

function playSong(song) {
    if (!domElements.currentSongDiv) return;
    
    domElements.currentSongDiv.classList.remove('hidden');
    domElements.currentSongName.textContent = song.name;
    
    // Create a new audio context if it doesn't exist
    if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Set the source
    domElements.audioPlayer.src = `/songs/${song.file}`;
    
    // Add event listeners for buffering
    domElements.audioPlayer.addEventListener('waiting', () => {
        console.log('Audio buffering...');
    });
    
    domElements.audioPlayer.addEventListener('canplay', () => {
        console.log('Audio ready to play');
        if (isHost) {
            socket.emit('hostControl', 'ready');
        }
    });

    domElements.audioPlayer.addEventListener('play', () => {
        // Ensure audio context is running
        if (window.audioContext && window.audioContext.state === 'suspended') {
            window.audioContext.resume();
        }
    });

    // Add error handling
    domElements.audioPlayer.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        if (e.target.error) {
            console.error('Error code:', e.target.error.code);
            console.error('Error message:', e.target.error.message);
        }
    });

    if (isHost) {
        // Enable controls for host
        domElements.audioPlayer.controls = true;
        
        // Add event listeners for host controls
        domElements.audioPlayer.addEventListener('play', () => {
            console.log('Host: Play');
            socket.emit('hostControl', { 
                action: 'play',
                time: domElements.audioPlayer.currentTime
            });
            socket.emit('timeUpdate', domElements.audioPlayer.currentTime);
        });

        // Add timeupdate event for host
        let lastUpdate = 0;
        domElements.audioPlayer.addEventListener('timeupdate', () => {
            const now = Date.now();
            if (now - lastUpdate > 1000) { // Send update every second
                socket.emit('timeUpdate', domElements.audioPlayer.currentTime);
                lastUpdate = now;
            }
        });

        domElements.audioPlayer.addEventListener('ended', () => {
            console.log('Host: Song ended naturally');
            socket.emit('hostControl', { action: 'ended' });
        });

        // Add stop button handler
        if (domElements.stopButton) {
            domElements.stopButton.addEventListener('click', () => {
                console.log('Host: Stop button clicked');
                socket.emit('hostControl', { action: 'stop' });
                domElements.audioPlayer.pause();
                domElements.audioPlayer.currentTime = 0;
            });
            domElements.stopButton.classList.remove('hidden');
        }

        // Load and play
        domElements.audioPlayer.load();
    } else {
        // For non-host clients
        domElements.audioPlayer.controls = false;
        domElements.audioPlayer.load();
        if (domElements.stopButton) {
            domElements.stopButton.classList.add('hidden');
        }
    }
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
