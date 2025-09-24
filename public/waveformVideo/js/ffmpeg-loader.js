/**
 * @file This module is responsible for loading and initializing the FFmpeg.wasm library.
 */

import {CORE_VERSION, FFMPEG_VERSION, baseURLFFMPEG, baseURLCore, baseURLCoreMT} from './constants.js';

let ffmpeg = null;

const CORE_SIZE = {
    [`${baseURLCoreMT}/ffmpeg-core.wasm`]: 32609891,
    [`${baseURLCore}/ffmpeg-core.wasm`]: 32129114,
};

async function toBlobURLPatched(url, mimeType, patcher) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`);
    let body = await resp.text();
    if (patcher) body = patcher(body);
    const blob = new Blob([body], {type: mimeType});
    return URL.createObjectURL(blob);
}

async function toBlobURLWithProgress(url, mimeType, progressCallback) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const total = parseInt(resp.headers.get('Content-Length') || '0', 10);
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

export async function initialize(progressCallback) {
    if (ffmpeg) return ffmpeg;

    const ffmpegBlobURL = await toBlobURLPatched(
        `${baseURLFFMPEG}/ffmpeg.js`, 'text/javascript',
        (js) => js.replace('new URL(e.p+e.u(814),e.b)', 'r.workerLoadURL')
    );
    await import(ffmpegBlobURL);

    // @ts-ignore
    ffmpeg = new FFmpegWASM.FFmpeg();

    const isMt = window.crossOriginIsolated;
    const coreBaseURL = isMt ? baseURLCoreMT : baseURLCore;

    const config = {
        workerLoadURL: await toBlobURLWithProgress(`${baseURLFFMPEG}/814.ffmpeg.js`, 'text/javascript', null),
        coreURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript', null),
        wasmURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm', progressCallback),
        ...(isMt && {workerURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.worker.js`, 'application/javascript', null)}),
    };

    await ffmpeg.load(config);
    return ffmpeg;
}