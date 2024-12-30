const socket = io();

// DOM Elements
const usernameInput = document.getElementById('username');
const joinButton = document.getElementById('join-btn');
const songsContainer = document.getElementById('songs-container');
const participantCount = document.getElementById('participant-count');
const muteBtn = document.getElementById('mute-btn');
const mutedIcon = muteBtn.querySelector('.muted');
const unmutedIcon = muteBtn.querySelector('.unmuted');
const timerDisplay = document.getElementById('timer-display');
const currentSongDisplay = document.getElementById('current-song');
const statusDisplay = document.getElementById('status-display');

let username;
let audioPlayer = new Audio();
let votingTimer;
let hasVoted = false;

// Event Listeners
joinButton.addEventListener('click', () => {
    username = usernameInput.value.trim();
    if (username) {
        socket.emit('joinVoting', username);
    }
});

muteBtn.addEventListener('click', () => {
    const isMuted = !audioPlayer.muted;
    audioPlayer.muted = isMuted;
    mutedIcon.classList.toggle('hidden', !isMuted);
    unmutedIcon.classList.toggle('hidden', isMuted);
});

// Socket Events
socket.on('joinError', (message) => {
    alert(message);
});

socket.on('updateParticipants', (data) => {
    participantCount.textContent = `${data.count} participants`;
});

socket.on('updateVotes', (songs) => {
    updateSongsDisplay(songs);
});

socket.on('gameState', (state) => {
    updateSongsDisplay(state.songs);
    if (state.currentlyPlaying) {
        displayCurrentSong(state.currentlyPlaying);
    }
    
    if (state.gameStarted) {
        showScreen('voting-screen');
        if (state.isVotingOpen) {
            statusDisplay.textContent = 'Voting in progress...';
        }
    } else {
        statusDisplay.textContent = `Waiting for more players (${state.participantCount}/${state.minPlayers} minimum)`;
    }
});

socket.on('votingStart', (data) => {
    hasVoted = false;
    updateSongsDisplay(data.songs);
    startVotingTimer(data.votingDuration);
    currentSongDisplay.textContent = 'Voting in progress...';
    statusDisplay.textContent = 'Choose your song!';
    if (audioPlayer.src) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
});

socket.on('playSong', (song) => {
    clearInterval(votingTimer);
    timerDisplay.textContent = '';
    displayCurrentSong(song);
    playSong(song);
    statusDisplay.textContent = 'Now playing...';
});

socket.on('gamePaused', (message) => {
    statusDisplay.textContent = message;
    if (audioPlayer.src) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    timerDisplay.textContent = '';
    currentSongDisplay.textContent = '';
});

// Helper Functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function updateSongsDisplay(songs) {
    songsContainer.innerHTML = '';
    songs.forEach(song => {
        const songCard = document.createElement('div');
        songCard.className = 'song-card';
        songCard.innerHTML = `
            <div class="song-info">
                <div class="song-name">${song.name}</div>
                <div class="vote-count">${song.votes} votes</div>
            </div>
            <button class="vote-button" onclick="voteSong(${song.id})" ${hasVoted ? 'disabled' : ''}>
                ${hasVoted ? 'Voted' : 'Vote'}
            </button>
        `;
        songsContainer.appendChild(songCard);
    });
}

function voteSong(songId) {
    socket.emit('vote', songId);
    hasVoted = true;
    updateSongsDisplay(songs); // Disable all vote buttons
}

function startVotingTimer(duration) {
    let timeLeft = duration;
    timerDisplay.textContent = `Time left to vote: ${timeLeft}s`;
    
    if (votingTimer) {
        clearInterval(votingTimer);
    }
    
    votingTimer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time left to vote: ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(votingTimer);
        }
    }, 1000);
}

function displayCurrentSong(song) {
    currentSongDisplay.textContent = `Now Playing: ${song.name}`;
}

function playSong(song) {
    audioPlayer.src = song.file;
    audioPlayer.play();
}
