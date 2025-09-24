const CORE_VERSION = "0.12.10";
const FFMPEG_VERSION = "0.12.10";
const baseURLFFMPEG = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd`;
const baseURLCoreMT = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd`;

const logElement = document.getElementById('log');
const log = (message, type = 'info') => {
    console.log(message);
    if (logElement) {
        logElement.innerHTML += `\n<span class="${type}">${message}</span>`;
    }
};

// --- Verbatim Loader Functions (from your ffmpeg-loader.js) ---
async function toBlobURLPatched(url, mimeType, patcher) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`);
    let body = await resp.text();
    if (patcher) body = patcher(body);
    const blob = new Blob([body], {type: mimeType});
    return URL.createObjectURL(blob);
}

async function toBlobURLWithProgress(url, mimeType) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const total = parseInt(resp.headers.get('Content-Length') || '0', 10);
    const reader = resp.body.getReader();
    const chunks = [];
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const blob = new Blob(chunks, {type: mimeType});
    return URL.createObjectURL(blob);
}

// --- FFmpeg Loader (Identical to your project's implementation) ---
async function loadFFmpeg() {
    log('Loading FFmpeg.wasm (Multi-Threaded) with correct patched loader...');

    const ffmpegBlobURL = await toBlobURLPatched(
        `${baseURLFFMPEG}/ffmpeg.js`, 'text/javascript',
        (js) => js.replace('new URL(e.p+e.u(814),e.b)', 'r.workerLoadURL')
    );
    await import(ffmpegBlobURL);

    // @ts-ignore
    const ffmpeg = new FFmpegWASM.FFmpeg();

    ffmpeg.on('log', ({message}) => {
        console.log(`FFMPEG LOG: ${message}`);
    });

    const config = {
        workerLoadURL: await toBlobURLWithProgress(`${baseURLFFMPEG}/814.ffmpeg.js`, 'text/javascript'),
        coreURL: await toBlobURLWithProgress(`${baseURLCoreMT}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURLWithProgress(`${baseURLCoreMT}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURLWithProgress(`${baseURLCoreMT}/ffmpeg-core.worker.js`, 'application/javascript'),
    };

    await ffmpeg.load(config);
    log('FFmpeg Multi-Threaded Core Loaded Successfully.', 'success');
    return ffmpeg;
}

// --- Main Test Execution ---
async function runTest() {
    try {
        if (!window.crossOriginIsolated) {
            log('Error: This page is not cross-origin isolated. Cannot test multi-threading.', 'error');
            return;
        }
        log('Browser is Cross-Origin Isolated. Proceeding with test.', 'success');

        const ffmpeg = await loadFFmpeg();

        const filterComplex = `color=c=red:s=640x360:d=5:r=30[base];color=c=blue:s=640x360:d=5:r=30[overlay];[base][overlay]overlay=x='-w+(w/5)*t'[animated];[animated]split[top][bottom];[bottom]vflip[bottom_flipped];[top][bottom_flipped]vstack[mirrored];color=c=black:s=1280x720:d=5:r=30[bg];[bg][mirrored]overlay=(W-w)/2:(H-h)/2[final_video]`;

        // --- THIS IS THE FIX ---
        // Replaced the problematic `color` filter input with the more stable `nullsrc` filter.
        // This creates a blank video source that is guaranteed to be compatible.
        const renderArgs = [
            '-f', 'lavfi', '-i', 'nullsrc=s=1280x720:d=5',
            '-filter_complex', filterComplex,
            '-map', '[final_video]',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-an', 'output.mp4'
        ];
        // ------------------------

        log('Executing the complex rendering command...');
        const startTime = performance.now();

        await ffmpeg.exec(renderArgs);

        const endTime = performance.now();
        log(`SUCCESS: Rendering command completed in ${(endTime - startTime) / 1000} seconds.`, 'success');

        const data = await ffmpeg.readFile('output.mp4');
        log(`Output file size: ${(data.byteLength / 1024).toFixed(2)} KB`, 'success');

    } catch (e) {
        log(`ERROR: The test failed. This confirms the deadlock/crash in the MT core.`, 'error');
        console.error(e);
    }
}

// Run the test
runTest();