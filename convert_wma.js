const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const songsDir = path.join(__dirname, 'public', 'songs');

// Read all files in the songs directory
fs.readdir(songsDir, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    // Filter WMA files
    const wmaFiles = files.filter(file => file.toLowerCase().endsWith('.wma'));

    // Convert each WMA file to MP3
    wmaFiles.forEach(wmaFile => {
        const inputPath = path.join(songsDir, wmaFile);
        const outputPath = path.join(songsDir, wmaFile.replace('.wma', '.mp3'));

        const command = `ffmpeg -i "${inputPath}" -acodec libmp3lame -ab 320k "${outputPath}"`;
        
        console.log(`Converting ${wmaFile} to MP3...`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error converting ${wmaFile}:`, error);
                return;
            }
            console.log(`Successfully converted ${wmaFile} to MP3`);
        });
    });
});
