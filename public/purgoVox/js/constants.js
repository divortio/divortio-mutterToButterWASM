/**
 * @file Central configuration for the MutterToButter audio processing pipeline.
 * This file contains all the tunable parameters for FFmpeg commands and pipeline behavior.
 */

// --- FFmpeg CDN Configuration ---
/** @constant {string} The version of the FFmpeg core library to use. */
export const CORE_VERSION = "0.12.10";
/** @constant {string} The version of the FFmpeg application library to use. */
export const FFMPEG_VERSION = "0.12.15";
/** @constant {string} The base URL for the main FFmpeg UMD build. */

// --- Local FFmpeg Configuration ---
/** @constant {string} The local path to the vendor directory. */
const VENDOR_PATH = '/vendor/';

/** @constant {string} The base URL for the main FFmpeg UMD build. */
export const baseURLFFMPEG = VENDOR_PATH;
/** @constant {string} The base URL for the single-threaded FFmpeg core. */
export const baseURLCore = VENDOR_PATH;
/** @constant {string} The base URL for the multi-threaded FFmpeg core. */
export const baseURLCoreMT = VENDOR_PATH;

// Remote
// export const baseURLFFMPEG = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd`;
// /** @constant {string} The base URL for the single-threaded FFmpeg core. */
// export const baseURLCore = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
// /** @constant {string} The base URL for the multi-threaded FFmpeg core. */
// export const baseURLCoreMT = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd`;

// --- Pipeline Configuration ---
/**
 * @constant {number} The duration of each audio chunk in seconds.
 * Corresponds to '-segment_time 300' in purgoVox.sh.
 */
export const CHUNK_DURATION = 300;
/**
 * @constant {string} The audio format/codec for the final output chunks.
 */
export const OUTPUT_FORMAT = "mp3";
/**
 * @constant {string} The default quality setting for the MP3 encoder.
 * Corresponds to the '-q:a 9' flag in the bash scripts.
 * '5' = High quality, '7' = Medium, '9' = Low quality (larger value is lower quality/smaller size).
 */
export const OUTPUT_QUALITY = "-q:a 9";


// --- Audio Mastering Parameters (from _process-chunk.sh) ---

// 1. Loudness Normalization (EBU R 128)
/** @constant {number} Integrated Loudness Target in LUFS. */
export const TARGET_LOUDNESS_LUFS = -14;
/** @constant {number} Maximum True Peak in dBFS. */
export const TARGET_TRUE_PEAK_DBFS = -1.0;
/** @constant {number} Loudness Range Target in LU. */
export const TARGET_LOUDNESS_RANGE_LU = 11;

// 2. Core Cleanup Filters
/** @constant {number} Frequency for the high-pass filter to remove rumble (in Hz). */
export const HIGH_PASS_FREQ_HZ = 80;
/** @constant {number} Noise floor for the spectral noise reduction filter (afftdn) (in dBFS). */
export const NOISE_FLOOR_DBFS = -25;