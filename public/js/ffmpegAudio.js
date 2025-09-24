import {toBlobURL, toBlobURLPatched} from './utils.js';
import {CORE_VERSION, FFMPEG_VERSION, baseURLFFMPEG, baseURLCore, baseURLCoreMT} from './constants.js';

let ffmpeg = null;

const load = async (progressCallback) => {
    const ffmpegBlobURL = await toBlobURLPatched(
        `${baseURLFFMPEG}/ffmpeg.js`, 'text/javascript', (js) => js.replace('new URL(e.p+e.u(814),e.b)', 'r.workerLoadURL')
    );
    await import(ffmpegBlobURL);

    ffmpeg = new FFmpegWASM.FFmpeg();

    if (window.crossOriginIsolated) {
        console.log("Attempting to load multi-threaded FFmpeg");
        await ffmpeg.load({
            workerLoadURL: await toBlobURL(`${baseURLFFMPEG}/814.ffmpeg.js`, 'text/javascript'),
            coreURL: await toBlobURL(`${baseURLCoreMT}/ffmpeg-core.js`, 'text/javascript', progressCallback),
            wasmURL: await toBlobURL(`${baseURLCoreMT}/ffmpeg-core.wasm`, 'application/wasm', progressCallback),
            workerURL: await toBlobURL(`${baseURLCoreMT}/ffmpeg-core.worker.js`, 'application/javascript'),
        });
    } else {
        console.log("Loading single-threaded FFmpeg as a fallback.");
        await ffmpeg.load({
            workerLoadURL: await toBlobURL(`${baseURLFFMPEG}/814.ffmpeg.js`, 'text/javascript'),
            coreURL: await toBlobURL(`${baseURLCore}/ffmpeg-core.js`, 'text/javascript', progressCallback),
            wasmURL: await toBlobURL(`${baseURLCore}/ffmpeg-core.wasm`, 'application/wasm', progressCallback),
        });
    }
};

export const initializeFFmpeg = async (progressCallback) => {
    try {
        console.log("Initializing FFmpeg for Audio...");
        await load(progressCallback);
        console.log("FFmpeg for Audio has been initialized.");
        return ffmpeg;
    } catch (error) {
        console.error("Failed to load FFmpeg:", error);
        return null;
    }
};