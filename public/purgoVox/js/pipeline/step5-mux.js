/**
 * @file Pipeline Step 5: Muxes the silent video with the original audio.
 */

import {runFFmpeg} from '../ffmpeg-run.js';

/**
 * Muxes the final silent video with the original audio file.
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string} silentVideoFile - The filename of the concatenated silent video.
 * @param {string} inputFile - The name of the original input audio file.
 * @param {object} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string>} The filename of the final muxed video.
 * @throws {Error} If muxing fails.
 */
export async function mux(ffmpeg, silentVideoFile, inputFile, updateUI, logStore) {
    const outputFilename = 'output.mp4';
    const args = [
        '-i', silentVideoFile,
        '-i', inputFile,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        outputFilename
    ];
    await runFFmpeg(ffmpeg, args, updateUI, logStore);

    // Validate that the final video was created
    const dirList = await ffmpeg.listDir('.');
    if (!dirList.some(f => f.name === outputFilename)) {
        throw new Error("Step 5 Failed: Muxing did not produce the final output video.");
    }

    return outputFilename;
}