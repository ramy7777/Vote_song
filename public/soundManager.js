class SoundManager {
    constructor() {
        this.sounds = {
            vote: new Audio('sounds/vote.mp3'),
            background: new Audio('sounds/background.mp3')
        };

        // Configure background music
        this.sounds.background.loop = true;
        this.sounds.background.volume = 0.3;

        // Configure sound effects
        this.sounds.vote.volume = 0.5;

        // Initialize mute state
        this.isMuted = false;
    }

    playBackground() {
        if (!this.isMuted) {
            this.sounds.background.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    stopBackground() {
        this.sounds.background.pause();
        this.sounds.background.currentTime = 0;
    }

    playVote() {
        if (!this.isMuted) {
            this.sounds.vote.currentTime = 0;
            this.sounds.vote.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBackground();
        } else {
            this.playBackground();
        }
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
