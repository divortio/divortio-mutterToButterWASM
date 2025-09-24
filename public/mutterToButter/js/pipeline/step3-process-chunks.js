/**
 * @file Pipeline Step 3: Processes each audio chunk into an animated video segment.
 */

import {runFFmpeg} from '../ffmpeg-run.js';
import {
    CHUNK_DURATION, WIDTH, HEIGHT, HALF_HEIGHT, NUM_BARS, NUM_BINS, BAR_WIDTH,
    GAP_WIDTH, MAX_HEIGHT_SCALE, FPS, WAVE_COLOR_UNPLAYED, WAVE_COLOR_PLAYED,
    BG_COLOR, X_OFFSET
} from '../constants.js';

/**
 * Processes all audio chunks into individual video segments.
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string[]} chunkFiles - An array of chunk filenames.
 * @param {object} updateUI - The UI update callback function.
 * @param {object} onProgress - The real-time progress callback for the sub-progress bar.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<{segmentFiles: string[], allPeakLevels: number[]}>} An object containing the list of created segment filenames and all collected peak levels.
 */
export async function processChunks(ffmpeg, chunkFiles, updateUI, onProgress, logStore) {
    const segmentFiles = [];
    const allPeakLevels = [];

    // Attach the real-time progress handler for this step
    ffmpeg.on('progress', ({ratio}) => {
        if (onProgress) onProgress(ratio);
    });

    for (let i = 0; i < chunkFiles.length; i++) {
        const chunkFile = chunkFiles[i];
        const segmentFile = `video_${String(i).padStart(4, '0')}.mp4`;
        segmentFiles.push(segmentFile);

        updateUI({
            progressMessage: `Step 3: Processing Segment (${i + 1}/${chunkFiles.length})`,
            progressStep: {current: 2, total: 5} // Keep main progress on Step 3
        });

        // 1. Analyze the chunk for peak levels
        logStore.clear();
        const sliceDuration = CHUNK_DURATION / NUM_BARS;

        // --- THIS IS THE FIX ---
        // Switched to the more robust `amovie` filter for analysis, which correctly
        // slices the audio and provides the necessary 100 data points for the 100 bars.
        // The output to 'null' and '-' is stable with the multi-threaded core.
        const analysisArgs = [
            '-f', 'lavfi',
            '-i', `amovie=${chunkFile},astats=metadata=1:length=${sliceDuration},ametadata=mode=print:key=lavfi.astats.Overall.Peak_level`,
            '-f', 'null',
            '-'
        ];
        await runFFmpeg(ffmpeg, analysisArgs, updateUI, logStore);
        // -----------------------

        const peakLevels = logStore.get().split('\n')
            .filter(line => line.includes('lavfi.astats.Overall.Peak_level='))
            .map(line => parseFloat(line.split('=')[1]));

        allPeakLevels.push(...peakLevels);

        // 2. Render the video segment
        let renderArgs;
        if (peakLevels.length === 0) {
            renderArgs = ['-f', 'lavfi', '-i', `color=c=${BG_COLOR}:s=${WIDTH}x${HEIGHT}:d=${CHUNK_DURATION}:r=${FPS}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', segmentFile];
        } else {
            let playedCmds = '', unplayedCmds = '';
            peakLevels.forEach((peakDb, barIndex) => {
                let level = 1;
                if (isFinite(peakDb)) {
                    if (peakDb > -6) level = 8; else if (peakDb > -12) level = 7;
                    else if (peakDb > -18) level = 6; else if (peakDb > -24) level = 5;
                    else if (peakDb > -30) level = 4; else if (peakDb > -36) level = 3;
                    else if (peakDb > -42) level = 2;
                }
                let barHeight = Math.max(1, Math.floor(((level * HALF_HEIGHT) / NUM_BINS) * MAX_HEIGHT_SCALE));
                const xPos = X_OFFSET + (barIndex * (BAR_WIDTH + GAP_WIDTH));
                const yPos = HALF_HEIGHT - barHeight;
                playedCmds += `drawbox=x=${xPos}:y=${yPos}:w=${BAR_WIDTH}:h=${barHeight}:c=${WAVE_COLOR_PLAYED}@1.0:t=fill,`;
                unplayedCmds += `drawbox=x=${xPos}:y=${yPos}:w=${BAR_WIDTH}:h=${barHeight}:c=${WAVE_COLOR_UNPLAYED}@1.0:t=fill,`;
            });

            const filterComplex = `[0:v] ${unplayedCmds.slice(0, -1)} [unplayed_wave]; [1:v] ${playedCmds.slice(0, -1)} [played_wave]; color=c=black:s=${WIDTH}x${HALF_HEIGHT}:d=${CHUNK_DURATION}:r=${FPS} [mask_base]; color=c=white:s=${WIDTH}x${HALF_HEIGHT}:d=${CHUNK_DURATION}:r=${FPS} [mask_color]; [mask_base][mask_color] overlay=x='-w+(w/${CHUNK_DURATION})*t' [animated_mask]; [played_wave][animated_mask] alphamerge [played_animated]; [unplayed_wave][played_animated] overlay [animated_top_half]; [animated_top_half] split [top][bottom]; [bottom] vflip [bottom_flipped]; [top][bottom_flipped] vstack [mirrored_waves]; color=c=${BG_COLOR}:s=${WIDTH}x${HEIGHT}:d=${CHUNK_DURATION}:r=${FPS} [bg]; [bg][mirrored_waves] overlay=(W-w)/2:(H-h)/2 [final_video]`;

            renderArgs = [
                '-f', 'lavfi', '-i', `color=c=black@0.0:s=${WIDTH}x${HALF_HEIGHT}:d=${CHUNK_DURATION}:r=${FPS}`,
                '-f', 'lavfi', '-i', `color=c=black@0.0:s=${WIDTH}x${HALF_HEIGHT}:d=${CHUNK_DURATION}:r=${FPS}`,
                '-filter_complex', filterComplex,
                '-map', '[final_video]', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-an', segmentFile
            ];
        }

        await runFFmpeg(ffmpeg, renderArgs, updateUI, logStore);
    }

    // Detach the progress handler now that this step is complete
    ffmpeg.off('progress');

    return {segmentFiles, allPeakLevels};
}