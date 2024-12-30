const socket = io();

// DOM Elements
const usernameInput = document.getElementById('username');
const joinButton = document.getElementById('join-btn');
const songsContainer = document.getElementById('songs-container');
const participantCount = document.getElementById('participant-count');
const muteBtn = document.getElementById('mute-btn');
const mutedIcon = muteBtn.querySelector('.muted');
const unmutedIcon = muteBtn.querySelector('.unmuted');

let username;

// Event Listeners
joinButton.addEventListener('click', () => {
    username = usernameInput.value.trim();
    if (username) {
        socket.emit('joinVoting', username);
        showScreen('voting-screen');
    }
});

muteBtn.addEventListener('click', () => {
    const isMuted = soundManager.toggleMute();
    mutedIcon.classList.toggle('hidden', !isMuted);
    unmutedIcon.classList.toggle('hidden', isMuted);
});

// Socket Events
socket.on('updateParticipants', (data) => {
    participantCount.textContent = data.count;
});

socket.on('updateVotes', (songs) => {
    updateSongsDisplay(songs);
    soundManager.playVote();
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
            <button class="vote-button" onclick="voteSong(${song.id})">Vote</button>
        `;
        songsContainer.appendChild(songCard);
    });
}

function voteSong(songId) {
    socket.emit('vote', songId);
}

// Preload sounds when the page loads
window.addEventListener('load', () => {
    soundManager.preloadAll();
});
