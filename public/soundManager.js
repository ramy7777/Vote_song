class SoundManager {
    constructor() {
        this.sounds = {
            vote: new Audio('sounds/vote.mp3')
        };

        // Configure sound effects
        this.sounds.vote.volume = 0.5;

        // Initialize mute state
        this.isMuted = false;

        // Load saved mute state from localStorage
        const savedMuteState = localStorage.getItem('soundMuted');
        if (savedMuteState !== null) {
            this.isMuted = savedMuteState === 'true';
            this.updateMuteState();
        }
    }

    playVote() {
        if (!this.isMuted) {
            this.sounds.vote.currentTime = 0;
            this.sounds.vote.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    updateMuteState() {
        Object.values(this.sounds).forEach(audio => {
            audio.muted = this.isMuted;
        });
        localStorage.setItem('soundMuted', this.isMuted);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.updateMuteState();
        return this.isMuted;
    }

    preloadAll() {
        // Preload all sounds
        Object.values(this.sounds).forEach(audio => {
            audio.load();
        });
    }
}

// Create a global instance
const soundManager = new SoundManager();
