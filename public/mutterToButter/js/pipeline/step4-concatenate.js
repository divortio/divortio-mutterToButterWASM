/**
 * @file Pipeline Step 4: Concatenates individual mastered audio segments into a single MP3 file and injects metadata.
 */

import {runFFmpeg} from '../ffmpeg-run.js';
import {OUTPUT_QUALITY} from '../constants.js';

/**
 * @typedef {object} Metadata
 * @property {string} title - The title for the MP3 tag.
 * @property {string} artist - The artist for the MP3 tag.
 * @property {string} album - The album for the MP3 tag.
 * @property {string} date - The date for the MP3 tag.
 * @property {string} comment - The comment for the MP3 tag.
 */

/**
 * Concatenates mastered audio segments into a single file and applies ID3 metadata.
 *
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string[]} processedFiles - A sorted list of the mastered audio segment filenames (e.g., ['chunk_0000_mastered.mp3']).
 * @param {Metadata} metadata - An object containing the ID3 tags for the final file.
 * @param {function} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string>} The filename of the final concatenated and tagged audio file.
 * @throws {Error} If concatenation fails.
 */
export async function concatenate(ffmpeg, processedFiles, metadata, updateUI, logStore) {
    const concatList = processedFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat_list.txt', concatList);

    const outputFilename = 'final_mastered.mp3';

    const metadataArgs = [
        '-metadata', `title=${metadata.title}`,
        '-metadata', `artist=${metadata.artist}`,
        '-metadata', `album=${metadata.album}`,
        '-metadata', `date=${metadata.date}`,
        '-metadata', `comment=${metadata.comment}`,
        '-metadata', `genre=Podcast`, // Static genre as per script's intent
        '-metadata', `album_artist=MutterToButter WASM` // Identify the tool
    ];

    const concatArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c', 'copy', // Copy the codec directly as chunks are already encoded
        ...metadataArgs,
        outputFilename
    ];

    await runFFmpeg(ffmpeg, concatArgs, updateUI, logStore);

    // Validate that the final audio file was created
    const dirList = await ffmpeg.listDir('.');
    if (!dirList.some(f => f.name === outputFilename)) {
        throw new Error("Step 4 Failed: Concatenation did not produce the expected output file.");
    }

    return outputFilename;
}