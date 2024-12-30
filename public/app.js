const socket = io();

let domElements = {};
let username;
let isHost = false;
let hasVoted = false;

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
        waitingMessage: document.getElementById('waiting-message')
    };

    // Event Listeners
    domElements.joinButton.addEventListener('click', () => {
        username = domElements.usernameInput.value.trim();
        if (username) {
            socket.emit('joinVoting', username);
            showScreen('waiting-screen');
        }
    });

    domElements.startGameBtn.addEventListener('click', () => {
        if (isHost) {
            socket.emit('startGame');
        }
    });

    domElements.muteBtn.addEventListener('click', () => {
        const isMuted = soundManager.toggleMute();
        domElements.mutedIcon.classList.toggle('hidden', !isMuted);
        domElements.unmutedIcon.classList.toggle('hidden', isMuted);
        domElements.audioPlayer.muted = isMuted;
    });
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
    isHost = data.isHost;
    if (domElements.hostControls) {
        domElements.hostControls.classList.toggle('hidden', !isHost);
    }
});

socket.on('error', (message) => {
    alert(message);
});

socket.on('gameState', (state) => {
    if (state.isVoting) {
        showScreen('voting-screen');
        updateSongsDisplay(state.songs);
    } else if (state.currentSong) {
        showScreen('voting-screen');
        playSong(state.currentSong);
    }
});

socket.on('newVotingRound', (songs) => {
    showScreen('voting-screen');
    domElements.currentSongDiv.classList.add('hidden');
    hasVoted = false;
    updateSongsDisplay(songs);
    soundManager.playVote();
});

socket.on('updateVotes', (songs) => {
    updateSongsDisplay(songs);
    soundManager.playVote();
});

socket.on('playSong', (song) => {
    playSong(song);
});

// Helper Functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function updateSongsDisplay(songs) {
    if (!domElements.songsContainer) return;
    
    domElements.songsContainer.innerHTML = '';
    songs.forEach(song => {
        const songCard = document.createElement('div');
        songCard.className = 'song-card' + (hasVoted ? ' disabled' : '');
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'song-name';
        nameDiv.textContent = song.name;
        
        const votesDiv = document.createElement('div');
        votesDiv.className = 'vote-count';
        votesDiv.textContent = `${song.votes} votes`;
        
        songCard.appendChild(nameDiv);
        songCard.appendChild(votesDiv);
        
        if (!hasVoted) {
            songCard.addEventListener('click', () => voteSong(song.id));
        }
        
        domElements.songsContainer.appendChild(songCard);
    });
}

function voteSong(songId) {
    if (!hasVoted) {
        socket.emit('vote', songId);
        hasVoted = true;
        soundManager.playVote();
    }
}

function playSong(song) {
    if (!domElements.currentSongDiv) return;
    
    domElements.currentSongDiv.classList.remove('hidden');
    domElements.currentSongName.textContent = song.name;
    domElements.audioPlayer.src = `/songs/${song.file}`;
    domElements.audioPlayer.play();
}

// Initialize when the page loads
window.addEventListener('load', () => {
    initializeDOMElements();
    soundManager.preloadAll();
});
