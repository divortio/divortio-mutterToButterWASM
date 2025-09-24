/**
 * @file This is the main orchestrator for the video generation pipeline.
 * It imports and executes each step in sequence.
 */

import {sanitize} from './pipeline/step0-sanitize.js';
import {analyze} from './pipeline/step1-analyze.js';
import {chunk} from './pipeline/step2-chunk.js';
import {processChunks} from './pipeline/step3-process-chunks.js';
import {concatenate} from './pipeline/step4-concatenate.js';
import {mux} from './pipeline/step5-mux.js';

export async function generateWaveformVideo(ffmpeg, file, updateUI, onProgress) {
    const overallStartTime = performance.now();
    let audioDuration = 0;
    const allPeakLevels = [];
    const cleanupPaths = [file.name];
    const TOTAL_STEPS = 6; // Updated total steps

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
        if (!ffmpeg) return;
        try {
            await ffmpeg.unmount('/input');
        } catch (e) {
        }
        try {
            await ffmpeg.deleteDir('/input');
        } catch (e) {
        }

        for (const path of cleanupPaths) {
            try {
                await ffmpeg.deleteFile(path);
            } catch (e) {
            }
        }
    };

    try {
        await ffmpeg.createDir('/input');
        await ffmpeg.mount('WORKERFS', {files: [file]}, '/input');

        ffmpeg.on('log', ({message}) => logStore.append(message));

        const originalInputFile = `/input/${file.name}`;

        // --- Step 0: Sanitize ---
        let stepStartTime = performance.now();
        updateUI({progressMessage: 'Step 1: Sanitizing Audio', progressStep: {current: 0, total: TOTAL_STEPS}});
        const sanitizedAudioFile = await sanitize(ffmpeg, originalInputFile, updateUI, logStore);
        cleanupPaths.push(sanitizedAudioFile);
        updateUI({
            progressMessage: 'Step 1: Sanitization Complete',
            progressStep: {current: 1, total: TOTAL_STEPS},
            stepTime: performance.now() - stepStartTime
        });

        // --- Step 1: Analyze ---
        stepStartTime = performance.now();
        updateUI({progressMessage: 'Step 2: Analyzing Audio', progressStep: {current: 1, total: TOTAL_STEPS}});
        audioDuration = await analyze(ffmpeg, sanitizedAudioFile, updateUI, logStore);
        updateUI({type: 'duration', duration: audioDuration});
        updateUI({
            progressMessage: 'Step 2: Analysis Complete',
            progressStep: {current: 2, total: TOTAL_STEPS},
            stepTime: performance.now() - stepStartTime
        });

        // --- Step 2: Chunk ---
        stepStartTime = performance.now();
        updateUI({progressMessage: 'Step 3: Chunking Audio', progressStep: {current: 2, total: TOTAL_STEPS}});
        const chunkFiles = await chunk(ffmpeg, sanitizedAudioFile, updateUI, logStore);
        cleanupPaths.push(...chunkFiles);
        updateUI({
            progressMessage: 'Step 3: Chunking Complete',
            progressStep: {current: 3, total: TOTAL_STEPS},
            stepTime: performance.now() - stepStartTime
        });

        // --- Step 3: Process Chunks ---
        stepStartTime = performance.now();
        const {
            segmentFiles,
            allPeakLevels: peaks
        } = await processChunks(ffmpeg, chunkFiles, updateUI, onProgress, logStore);
        allPeakLevels.push(...peaks);
        cleanupPaths.push(...segmentFiles);
        updateUI({
            progressMessage: 'Step 4: Processing Complete',
            progressStep: {current: 4, total: TOTAL_STEPS},
            stepTime: performance.now() - stepStartTime
        });

        // --- Step 4: Concatenate ---
        stepStartTime = performance.now();
        updateUI({progressMessage: 'Step 5: Concatenating', progressStep: {current: 4, total: TOTAL_STEPS}});
        const silentVideoFile = await concatenate(ffmpeg, segmentFiles, updateUI, logStore);
        cleanupPaths.push(silentVideoFile, 'concat_list.txt');
        updateUI({
            progressMessage: 'Step 5: Concatenation Complete',
            progressStep: {current: 5, total: TOTAL_STEPS},
            stepTime: performance.now() - stepStartTime
        });

        // --- Step 5: Mux Audio ---
        stepStartTime = performance.now();
        updateUI({progressMessage: 'Step 6: Muxing Audio', progressStep: {current: 5, total: TOTAL_STEPS}});
        const finalVideoFile = await mux(ffmpeg, silentVideoFile, sanitizedAudioFile, updateUI, logStore);
        cleanupPaths.push(finalVideoFile);
        updateUI({
            progressMessage: 'Step 6: Muxing Complete',
            progressStep: {current: 6, total: TOTAL_STEPS},
            stepTime: performance.now() - stepStartTime
        });

        // --- Finalization ---
        ffmpeg.off('log');
        const data = await ffmpeg.readFile(finalVideoFile);
        const videoBlob = new Blob([data.buffer], {type: 'video/mp4'});

        const measurements = {sourceFile: file.name, generatedAt: new Date().toISOString(), peakLevels: allPeakLevels};
        const measurementsString = JSON.stringify(measurements, null, 2);
        const measurementsBlob = new Blob([measurementsString], {type: 'application/json'});

        await cleanup();
        return {
            videoBlob,
            measurementsBlob,
            measurementsString,
            audioDuration,
            executionTime: performance.now() - overallStartTime
        };

    } catch (error) {
        console.error("Caught error during pipeline execution:", error);
        if (ffmpeg) {
            ffmpeg.off('log');
            ffmpeg.off('progress');
        }
        await cleanup();
        return {error, executionTime: performance.now() - overallStartTime};
    }
}