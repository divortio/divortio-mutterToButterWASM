import {CORE_VERSION, FFMPEG_VERSION} from './constants.js';

const CORE_SIZE = {
    [`https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`]: 114673,
    [`https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.wasm`]: 32129114,
    [`https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd/ffmpeg-core.js`]: 132680,
    [`https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd/ffmpeg-core.wasm`]: 32609891,
    [`https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd/ffmpeg-core.worker.js`]: 2915,
    [`https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd/814.ffmpeg.js`]: 2648,
};

export const toBlobURLPatched = async (url, mimeType, patcher) => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`);
    let body = await resp.text();
    if (patcher) body = patcher(body);
    const blob = new Blob([body], {type: mimeType});
    return URL.createObjectURL(blob);
};

export const toBlobURL = async (url, mimeType, cb) => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);

    const total = CORE_SIZE[url] || 0;
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
        const {done, value} = await reader.read();
        if (done) {
            cb && cb({url, total, received, delta: 0, done});
            break;
        }
        chunks.push(value);
        received += value.length;
        cb && cb({url, total, received, delta: value.length, done});
    }

    const data = new Uint8Array(received);
    let position = 0;
    for (const chunk of chunks) {
        data.set(chunk, position);
        position += chunk.length;
    }
    const blob = new Blob([data.buffer], {type: mimeType});
    return URL.createObjectURL(blob);
};