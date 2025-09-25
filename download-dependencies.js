// download-dependencies.js

import fetch from 'node-fetch';
import fs from 'fs'; // BUG FIX: Import the core 'fs' module
import path from 'path';
import {pipeline} from 'stream/promises';

// --- Configuration (from your constants.js) ---
const FFMPEG_VERSION = "0.12.10";
const CORE_VERSION = "0.12.10";

const VENDOR_DIR = path.join('public', 'mutterToButter', 'vendor');

const filesToDownload = [
    // Main FFmpeg library files
    {
        url: `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd/ffmpeg.js`,
        dest: 'ffmpeg.js'
    },
    {
        url: `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd/814.ffmpeg.js`,
        dest: '814.ffmpeg.js'
    },
    // Single-Threaded Core files
    {
        url: `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`,
        dest: 'ffmpeg-core.js'
    },
    {
        url: `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.wasm`,
        dest: 'ffmpeg-core.wasm'
    },
    // Multi-Threaded Core files
    {
        url: `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd/ffmpeg-core.js`,
        dest: 'ffmpeg-core-mt.js'
    },
    {
        url: `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd/ffmpeg-core.wasm`,
        dest: 'ffmpeg-core-mt.wasm'
    },
    {
        url: `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd/ffmpeg-core.worker.js`,
        dest: 'ffmpeg-core.worker.js'
    }
];

// --- Download Logic ---

/**
 * Downloads a file from a URL to a specified path using node-fetch.
 * @param {string} url The URL of the file to download.
 * @param {string} destPath The local path to save the file.
 * @returns {Promise<void>} A promise that resolves when the download is complete.
 */
async function downloadFile(url, destPath) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download ${url}: Status Code ${response.status}`);
        }
        // Use stream pipeline for robustly writing the file
        await pipeline(response.body, fs.createWriteStream(destPath));
        console.log(`✅ Downloaded: ${path.basename(destPath)}`);
    } catch (error) {
        console.error(`❌ Error downloading ${url}:`, error.message);
        // Attempt to clean up the partial file on error
        try {
            fs.unlinkSync(destPath);
        } catch (cleanupError) {
            // Ignore if cleanup fails
        }
        throw error; // Re-throw to fail the Promise.all
    }
}

/**
 * Main function to run the download process.
 */
async function main() {
    console.log(`Ensuring vendor directory exists at: ${VENDOR_DIR}`);
    // BUG FIX: Use the synchronous mkdirSync from the core 'fs' module
    if (!fs.existsSync(VENDOR_DIR)) {
        fs.mkdirSync(VENDOR_DIR, {recursive: true});
    }

    console.log('Starting download of FFmpeg.wasm dependencies...');

    try {
        const downloadPromises = filesToDownload.map(fileInfo => {
            const destPath = path.join(VENDOR_DIR, fileInfo.dest);
            return downloadFile(fileInfo.url, destPath);
        });

        await Promise.all(downloadPromises);
        console.log('\nAll dependencies downloaded successfully!');
    } catch (error) {
        console.error('\nDownload process failed. Please check the errors above.');
        process.exit(1); // Exit with an error code
    }
}

main();