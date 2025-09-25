/**
 * @file This is the main orchestrator for the MutterToButter audio mastering pipeline.
 */

import {sanitize} from './pipeline/step0-sanitize.js';
import {analyze} from './pipeline/step1-analyze.js';
import {chunk} from './pipeline/step2-chunk.js';
import {processChunks} from './pipeline/step3-process-chunks.js';
import {concatenate} from './pipeline/step4-concatenate.js';

/**
 * @typedef {import('./pipeline/step3-process-chunks.js').MasteringOptions} MasteringOptions
 */

/**
 * Executes the full audio mastering pipeline.
 *
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {File} file - The user-uploaded audio file.
 * @param {MasteringOptions} options - User-selected mastering options from the UI.
 * @param {function} updateUI - The UI update callback function.
 * @returns {Promise<{audioBlob: Blob, audioDuration: number, executionTime: number, error?: Error}>} The result of the pipeline execution.
 */
export async function runMasteringPipeline(ffmpeg, file, options, updateUI) {
    const overallStartTime = performance.now();
    let audioDuration = 0;
    const cleanupPaths = [];

    const logStore = {
        logs: '',
        append: function (message) {
            this.logs += message + '\n';
            updateUI({logs: message});
        },
        get: function () {
            return this.logs;
        },
        clear: function () {
            this.logs = '';
        }
    };

    const cleanup = async () => {
        for (const path of cleanupPaths) {
            try {
                await ffmpeg.deleteFile(path);
            } catch (e) { /* ignore */
            }
        }
    };

    try {
        await ffmpeg.writeFile(file.name, new Uint8Array(await file.arrayBuffer()));
        cleanupPaths.push(file.name);

        ffmpeg.on('log', ({message}) => logStore.append(message));

        // Step 0: Sanitize
        updateUI({progressMessage: 'Step 1/5: Sanitizing Audio...', progressStep: {current: 1, total: 5}});
        const sanitizedAudioFile = await sanitize(ffmpeg, file.name, updateUI, logStore);
        cleanupPaths.push(sanitizedAudioFile);

        // Step 1: Analyze
        updateUI({progressMessage: 'Step 2/5: Analyzing Audio...', progressStep: {current: 2, total: 5}});
        const {duration, channelLayout} = await analyze(ffmpeg, sanitizedAudioFile, updateUI, logStore);
        audioDuration = duration;
        updateUI({type: 'duration', duration: audioDuration});

        // Step 2: Chunk
        updateUI({progressMessage: 'Step 3/5: Chunking Audio...', progressStep: {current: 3, total: 5}});
        const chunkFiles = await chunk(ffmpeg, sanitizedAudioFile, updateUI, logStore);
        cleanupPaths.push(...chunkFiles);

        // Step 3: Process Chunks
        updateUI({progressMessage: 'Step 4/5: Mastering Chunks...', progressStep: {current: 4, total: 5}});

        // --- BUG FIX: The arguments passed to processChunks were in the wrong order. ---
        // The `updateUI` function must be passed before `logStore`.
        const {processedFiles} = await processChunks(ffmpeg, chunkFiles, channelLayout, options, updateUI, logStore);
        // --- END BUG FIX ---

        cleanupPaths.push(...processedFiles);

        // Step 4: Concatenate & Tag
        updateUI({progressMessage: 'Step 5/5: Assembling Final File...', progressStep: {current: 5, total: 5}});
        const metadata = {
            title: `${file.name} (Mastered)`,
            artist: 'MutterToButter WASM',
            album: new Date().toLocaleDateString(),
            date: new Date().getFullYear().toString(),
            comment: `Processed with MutterToButter WASM.`
        };
        const finalAudioFile = await concatenate(ffmpeg, processedFiles, metadata, updateUI, logStore);
        cleanupPaths.push(finalAudioFile, 'concat_list.txt');

        // Finalization
        ffmpeg.off('log');
        const data = await ffmpeg.readFile(finalAudioFile);
        const audioBlob = new Blob([data.buffer], {type: 'audio/mpeg'});

        await cleanup();
        return {
            audioBlob,
            audioDuration,
            executionTime: performance.now() - overallStartTime
        };

    } catch (error) {
        console.error("Caught error during pipeline execution:", error);
        ffmpeg.off('log');
        await cleanup();
        return {error, executionTime: performance.now() - overallStartTime};
    }
}