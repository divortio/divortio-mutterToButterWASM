/**
 * @file Pipeline Step 2: Splits the input audio into 5-second WAV chunks.
 */

import {runFFmpeg} from '../ffmpeg-run.js';
import {CHUNK_DURATION} from '../constants.js';

/**
 * Splits the audio file into 5-second WAV chunks.
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The name of the input file in the virtual filesystem.
 * @param {object} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string[]>} A sorted list of the created chunk filenames.
 * @throws {Error} If chunking fails or produces no files.
 */
export async function chunk(ffmpeg, inputFile, updateUI, logStore) {

    // --- THIS IS THE FIX ---
    // Added "-map 0:a:0" to ensure only the audio stream is chunked.
    const chunkingArgs = [
        '-i', inputFile,
        '-map', '0:a:0',
        '-f', 'segment',
        '-segment_time', String(CHUNK_DURATION),
        '-c:a', 'pcm_s16le',
        'chunk_%04d.wav'
    ];
    await runFFmpeg(ffmpeg, chunkingArgs, updateUI, logStore);
    // -----------------------

    const dirList = await ffmpeg.listDir('.');
    const chunkFiles = dirList
        .filter(f => f.name.startsWith('chunk_') && f.name.endsWith('.wav'))
        .map(f => f.name)
        .sort();

    if (chunkFiles.length === 0) {
        throw new Error("Step 2 Failed: Audio file could not be chunked. It might be too short or in an unsupported format.");
    }

    return chunkFiles;
}