/**
 * @file Pipeline Step 2: Splits the input audio into large WAV chunks.
 */

import {runFFmpeg} from '../ffmpeg-run.js';
import {CHUNK_DURATION} from '../constants.js';

/**
 * Splits the sanitized audio file into large WAV chunks for processing.
 *
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The name of the sanitized input file in the virtual filesystem.
 * @param {function} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string[]>} A sorted list of the created chunk filenames (e.g., ['chunk_0000.wav', ...]).
 * @throws {Error} If chunking fails or produces no files.
 */
export async function chunk(ffmpeg, inputFile, updateUI, logStore) {
    const chunkingArgs = [
        '-i', inputFile,
        '-f', 'segment',
        '-segment_time', String(CHUNK_DURATION),
        '-c:a', 'pcm_s16le', // Output raw WAV for accurate processing
        'chunk_%04d.wav'
    ];
    await runFFmpeg(ffmpeg, chunkingArgs, updateUI, logStore);

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