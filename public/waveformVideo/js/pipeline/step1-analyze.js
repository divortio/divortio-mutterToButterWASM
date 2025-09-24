/**
 * @file Pipeline Step 1: Analyzes the input audio file to determine its duration.
 */

import {runFFmpeg} from '../ffmpeg-run.js';

/**
 * Analyzes the audio file to get its duration using the stable transcoding method.
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The path to the input file in the virtual filesystem (e.g., /input/THX.mp3).
 * @param {object} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<number>} The duration of the audio in seconds.
 * @throws {Error} If the duration cannot be determined.
 */
export async function analyze(ffmpeg, inputFile, updateUI, logStore) {
    logStore.clear();

    // This is the stable method. Creating a small temporary output file forces
    // FFmpeg to process the input and print its full metadata to the log.
    const tempOutputFile = 'temp_for_analysis.wav';
    const args = ['-hide_banner', '-i', inputFile, '-t', '1', '-f', 'wav', tempOutputFile]

    await runFFmpeg(ffmpeg, args , updateUI, logStore);

    // The temp file is no longer needed, so we clean it up immediately.
    await ffmpeg.deleteFile(tempOutputFile);

    const durationMatch = logStore.get().match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (!durationMatch) {
        throw new Error("Step 1 Failed: Could not determine audio duration from the file's metadata. The file may be corrupt or unsupported.");
    }

    const [, hours, minutes, seconds, centiseconds] = durationMatch;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
}