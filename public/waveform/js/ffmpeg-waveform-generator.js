import {
    DURATION,
    WIDTH,
    HEIGHT,
    HALF_HEIGHT,
    NUM_BARS,
    NUM_BINS,
    BAR_WIDTH,
    GAP_WIDTH,
    MAX_HEIGHT_SCALE,
    WAVE_COLOR,
    BG_COLOR,
    TOTAL_STEPS
} from './constants.js';

export const ffmpegWaveformGenerator = (() => {
    const generateWaveform = async (file, ffmpeg, updateUI) => {
        const startTime = performance.now();
        let audioDuration = 0;

        try {
            await ffmpeg.createDir('/input');
            await ffmpeg.mount('WORKERFS', {files: [file]}, '/input');

            // Step 1: Create Audio Chunk & Get Duration
            const tempChunk = 'chunk.wav';
            let initialAnalysisOutput = '';
            const initialLogger = ({message}) => {
                initialAnalysisOutput += message + '\n';
                updateUI({logs: message});
            };
            ffmpeg.on('log', initialLogger);
            const chunkArgs = ['-i', `/input/${file.name}`, '-t', String(DURATION), '-c:a', 'pcm_s16le', tempChunk];
            updateUI({command: `ffmpeg ${chunkArgs.join(' ')}`, progressStep: {current: 0, total: TOTAL_STEPS}});
            await ffmpeg.exec(chunkArgs);
            updateUI({progressStep: {current: 1, total: TOTAL_STEPS}});
            ffmpeg.off('log', initialLogger);

            const durationMatch = initialAnalysisOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
            if (durationMatch) {
                const [, hours, minutes, seconds, milliseconds] = durationMatch;
                audioDuration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 100;
            }

            // Step 2: Analyze Audio Levels
            let levelAnalysisOutput = '';
            const levelLogger = ({message}) => {
                levelAnalysisOutput += message + '\n';
                updateUI({logs: message});
            };
            ffmpeg.on('log', levelLogger);
            const sliceDuration = DURATION / NUM_BARS;
            const analyzeArgs = ['-f', 'lavfi', '-i', `amovie=${tempChunk},astats=metadata=1:length=${sliceDuration},ametadata=mode=print:key=lavfi.astats.Overall.Peak_level`, '-f', 'null', '-'];
            updateUI({command: `ffmpeg ${analyzeArgs.join(' ')}`});
            await ffmpeg.exec(analyzeArgs);
            updateUI({progressStep: {current: 2, total: TOTAL_STEPS}});
            ffmpeg.off('log', levelLogger);

            const peakLevels = levelAnalysisOutput.split('\n').filter(line => line.includes('lavfi.astats.Overall.Peak_level=')).map(line => parseFloat(line.split('=')[1]));
            if (peakLevels.length === 0) throw new Error("Could not extract peak levels from the audio file.");

            // Step 3 & 4: Process and Render
            let maxPeakDb = Math.max(...peakLevels.filter(p => isFinite(p)), -999);
            if (maxPeakDb === -999) maxPeakDb = 0;
            let drawCmds = peakLevels.map((peakDb, barIndex) => {
                let amp = isFinite(peakDb) ? Math.pow(10, (peakDb - maxPeakDb) / 20) : 0;
                let lvl = Math.max(1, Math.floor(amp * NUM_BINS + 0.9999));
                let h = Math.max(1, Math.floor(((lvl * HALF_HEIGHT) / NUM_BINS) * MAX_HEIGHT_SCALE));
                const x = Math.floor((WIDTH - (NUM_BARS * BAR_WIDTH + (NUM_BARS - 1) * GAP_WIDTH)) / 2) + (barIndex * (BAR_WIDTH + GAP_WIDTH));
                const y = HALF_HEIGHT - h;
                return `drawbox=x=${x}:y=${y}:w=${BAR_WIDTH}:h=${h}:c=${WAVE_COLOR}:t=fill,drawbox=x=${x}:y=${HALF_HEIGHT}:w=${BAR_WIDTH}:h=${h}:c=${WAVE_COLOR}:t=fill`;
            }).join(',');

            const outputPng = 'waveform.png';
            const renderArgs = ['-y', '-f', 'lavfi', '-i', `color=c=${BG_COLOR}:s=${WIDTH}x${HEIGHT}:d=1:r=1`, '-filter_complex', drawCmds, '-frames:v', '1', '-update', '1', outputPng];
            updateUI({command: `ffmpeg ${renderArgs.join(' ')}`});
            await ffmpeg.exec(renderArgs);
            updateUI({progressStep: {current: 3, total: TOTAL_STEPS}});

            // Step 5: Serialize & Cleanup
            const measurements = {
                sourceFile: file.name,
                generatedAt: new Date().toISOString(),
                constants: {DURATION, WIDTH, HEIGHT, NUM_BARS, NUM_BINS},
                peakLevels
            };
            const measurementsString = JSON.stringify(measurements, null, 2);
            const measurementsBlob = new Blob([measurementsString], {type: 'application/json'});
            const data = await ffmpeg.readFile(outputPng);
            const waveformBlob = new Blob([data.buffer], {type: 'image/png'});

            await ffmpeg.deleteFile(tempChunk);
            await ffmpeg.deleteFile(outputPng);
            await ffmpeg.unmount('/input');

            const executionTime = performance.now() - startTime;
            return {
                waveformBlob,
                measurementsBlob,
                measurementsString,
                audioDuration,
                executionTime,
                pngWidth: WIDTH,
                pngHeight: HEIGHT
            };

        } catch (error) {
            console.error("Error during waveform generation:", error);
            const executionTime = performance.now() - startTime;
            updateUI({error: {message: `An error occurred: ${error.message}.`, executionTime}});
            return null;
        }
    };
    return {generateWaveform};
})();