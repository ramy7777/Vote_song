function createSnowflake() {
    const snowflake = document.createElement('div');
    snowflake.className = 'snowflake';
    
    // Random starting position
    const startingX = Math.random() * window.innerWidth;
    snowflake.style.left = startingX + 'px';
    
    // Random size between 3px and 10px
    const size = Math.random() * 7 + 3;
    snowflake.style.width = size + 'px';
    snowflake.style.height = size + 'px';
    
    // Random animation duration between 5s and 10s
    const animationDuration = Math.random() * 5 + 5;
    snowflake.style.animation = `snowfall ${animationDuration}s linear forwards`;
    
    // Add to container
    const container = document.querySelector('.snowfall-container');
    container.appendChild(snowflake);
    
    // Remove snowflake after animation
    setTimeout(() => {
        snowflake.remove();
    }, animationDuration * 1000);
}

function startSnowfall() {
    // Create container if it doesn't exist
    if (!document.querySelector('.snowfall-container')) {
        const container = document.createElement('div');
        container.className = 'snowfall-container';
        document.body.appendChild(container);
    }
    
    // Create snowflakes at random intervals
    setInterval(createSnowflake, 200);
}

// Start snowfall when the page loads
window.addEventListener('load', startSnowfall);
