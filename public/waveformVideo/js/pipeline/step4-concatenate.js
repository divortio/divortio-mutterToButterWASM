/**
 * @file Pipeline Step 4: Concatenates individual video segments into a single silent video.
 */

import {runFFmpeg} from '../ffmpeg-run.js';

/**
 * Concatenates video segments into a single file.
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string[]} segmentFiles - A sorted list of the video segment filenames.
 * @param {object} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string>} The filename of the final concatenated silent video.
 * @throws {Error} If concatenation fails.
 */
export async function concatenate(ffmpeg, segmentFiles, updateUI, logStore) {
    const concatList = segmentFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat_list.txt', concatList);

    const outputFilename = 'final_silent.mp4';
    await runFFmpeg(ffmpeg,['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', '-c', 'copy', outputFilename], updateUI, logStore);

    // Validate that the final silent video was created
    const dirList = await ffmpeg.listDir('.');
    if (!dirList.some(f => f.name === outputFilename)) {
        throw new Error("Step 4 Failed: Concatenation did not produce the expected output file.");
    }

    return outputFilename;
}