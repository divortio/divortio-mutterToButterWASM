/**
 * @file Pipeline Step 0: Sanitizes the input file by extracting only the audio stream into a clean WAV file.
 */

import {runFFmpeg} from '../ffmpeg-run.js';

/**
 * Creates a clean, audio-only WAV file from the input.
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The path to the original input file in the virtual filesystem.
 * @param {object} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string>} The filename of the sanitized audio file.
 * @throws {Error} If sanitization fails.
 */
export async function sanitize(ffmpeg, inputFile, updateUI, logStore) {
    logStore.clear();
    const sanitizedOutputFile = 'sanitized_audio.wav';

    const args = [
        '-hide_banner',
        '-i', inputFile,
        '-map', '0:a:0', // Explicitly select only the first audio stream
        '-c:a', 'pcm_s16le', // Convert to standard WAV format
        sanitizedOutputFile
    ];

    await runFFmpeg(ffmpeg, args, updateUI, logStore);

    // Verify the file was created
    const dirList = await ffmpeg.listDir('.');
    if (!dirList.some(f => f.name === sanitizedOutputFile)) {
        throw new Error("Step 0 Failed: Sanitization did not produce the expected audio file. The input file may not have a valid audio stream.");
    }

    return sanitizedOutputFile;
}