import {
    CORE_VERSION, FFMPEG_VERSION, baseURLFFMPEG, baseURLCore, baseURLCoreMT,
    DURATION, WIDTH, HEIGHT, HALF_HEIGHT, NUM_BARS, NUM_BINS, BAR_WIDTH,
    GAP_WIDTH, MAX_HEIGHT_SCALE, WAVE_COLOR, BG_COLOR, TOTAL_STEPS
} from './constants.js';

let ffmpeg = null;

const CORE_SIZE = {
    [`${baseURLCoreMT}/ffmpeg-core.wasm`]: 32609891,
    [`${baseURLCore}/ffmpeg-core.wasm`]: 32129114,
};

// --- THIS IS THE CRITICAL FIX for the network error ---
// This function fetches a script and applies a patch before creating a Blob URL.
// It's required to make ffmpeg.js load its worker from the correct location.
async function toBlobURLPatched(url, mimeType, patcher) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`);
    let body = await resp.text();
    if (patcher) body = patcher(body);
    const blob = new Blob([body], {type: mimeType});
    return URL.createObjectURL(blob);
}

// Helper for loading other FFmpeg scripts with progress tracking
async function toBlobURLWithProgress(url, mimeType, progressCallback) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);

    const total = CORE_SIZE[url] || parseInt(resp.headers.get('Content-Length') || '0', 10);
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (progressCallback && total) {
            progressCallback(received / total);
        }
    }

    const blob = new Blob(chunks, {type: mimeType});
    return URL.createObjectURL(blob);
}


// --- FFmpeg Initializer ---
export async function initialize(progressCallback) {
    if (ffmpeg) return ffmpeg;

    // Load the main ffmpeg.js script using the special patched function
    const ffmpegBlobURL = await toBlobURLPatched(
        `${baseURLFFMPEG}/ffmpeg.js`,
        'text/javascript',
        (js) => js.replace('new URL(e.p+e.u(814),e.b)', 'r.workerLoadURL')
    );
    await import(ffmpegBlobURL);

    // @ts-ignore
    ffmpeg = new FFmpegWASM.FFmpeg();

    const isMt = window.crossOriginIsolated;
    const coreBaseURL = isMt ? baseURLCoreMT : baseURLCore;

    const config = {
        // This is where the patched loader will look for the worker URL
        workerLoadURL: await toBlobURLWithProgress(`${baseURLFFMPEG}/814.ffmpeg.js`, 'text/javascript', null),
        coreURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript', null),
        wasmURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm', progressCallback),
        ...(isMt && {workerURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.worker.js`, 'application/javascript', null)}),
    };

    await ffmpeg.load(config);
    return ffmpeg;
}

// --- Waveform Generator (No changes below this line) ---
export async function generateWaveform(file, updateUI) {
    if (!ffmpeg) throw new Error("FFmpeg is not initialized.");

    const startTime = performance.now();
    let audioDuration = 0;

    try {
        await ffmpeg.createDir('/input');
        await ffmpeg.mount('WORKERFS', {files: [file]}, '/input');

        let outputLog = '';
        const logger = ({message}) => {
            outputLog += message + '\n';
            updateUI({logs: message});
        };
        ffmpeg.on('log', logger);

        const tempChunk = 'chunk.wav';
        const chunkArgs = ['-i', `/input/${file.name}`, '-t', String(DURATION), '-c:a', 'pcm_s16le', tempChunk];
        updateUI({command: `ffmpeg ${chunkArgs.join(' ')}`, progressStep: {current: 1, total: TOTAL_STEPS}});
        await ffmpeg.exec(chunkArgs);

        const durationMatch = outputLog.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (durationMatch) {
            const [, hours, minutes, seconds, centiseconds] = durationMatch;
            audioDuration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
        }
        outputLog = '';

        const sliceDuration = DURATION / NUM_BARS;
        const analyzeArgs = ['-f', 'lavfi', '-i', `amovie=${tempChunk},astats=metadata=1:length=${sliceDuration},ametadata=mode=print:key=lavfi.astats.Overall.Peak_level`, '-f', 'null', '-'];
        updateUI({command: `ffmpeg ${analyzeArgs.join(' ')}`, progressStep: {current: 2, total: TOTAL_STEPS}});
        await ffmpeg.exec(analyzeArgs);

        const peakLevels = outputLog.split('\n')
            .filter(line => line.includes('lavfi.astats.Overall.Peak_level='))
            .map(line => parseFloat(line.split('=')[1]));

        if (peakLevels.length === 0) throw new Error("Could not extract peak levels from the audio file.");
        outputLog = '';

        const maxPeakDb = Math.max(...peakLevels.filter(p => isFinite(p)), -999);
        const drawCmds = peakLevels.map((peakDb, barIndex) => {
            const amp = isFinite(peakDb) ? Math.pow(10, (peakDb - maxPeakDb) / 20) : 0;
            const lvl = Math.max(1, Math.floor(amp * NUM_BINS + 0.9999));
            const h = Math.max(1, Math.floor(((lvl * HALF_HEIGHT) / NUM_BINS) * MAX_HEIGHT_SCALE));
            const x = Math.floor((WIDTH - (NUM_BARS * BAR_WIDTH + (NUM_BARS - 1) * GAP_WIDTH)) / 2) + (barIndex * (BAR_WIDTH + GAP_WIDTH));
            return `drawbox=x=${x}:y=${HALF_HEIGHT - h}:w=${BAR_WIDTH}:h=${h}:c=${WAVE_COLOR}:t=fill,drawbox=x=${x}:y=${HALF_HEIGHT}:w=${BAR_WIDTH}:h=${h}:c=${WAVE_COLOR}:t=fill`;
        }).join(',');

        const outputPng = 'waveform.png';
        const renderArgs = ['-y', '-f', 'lavfi', '-i', `color=c=${BG_COLOR}:s=${WIDTH}x${HEIGHT}:d=1:r=1`, '-filter_complex', drawCmds, '-frames:v', '1', outputPng];
        updateUI({command: `ffmpeg ${renderArgs.join(' ')}`, progressStep: {current: 3, total: TOTAL_STEPS}});
        await ffmpeg.exec(renderArgs);
        ffmpeg.off('log', logger);

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

        return {
            waveformBlob, measurementsBlob, measurementsString, audioDuration,
            executionTime: performance.now() - startTime, pngWidth: WIDTH, pngHeight: HEIGHT
        };

    } catch (error) {
        console.error("Error during waveform generation:", error);
        return {error, executionTime: performance.now() - startTime};
    }
}