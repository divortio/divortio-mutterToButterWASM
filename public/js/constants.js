// --- FFmpeg CDN Configuration ---
export const CORE_VERSION = "0.12.6";
export const FFMPEG_VERSION = "0.12.10";
export const baseURLFFMPEG = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd`;
export const baseURLCore = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
export const baseURLCoreMT = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd`;

// --- Waveform Generation Constants ---
export const DURATION = 5;
export const WIDTH = 1280;
export const HEIGHT = 720;
export const HALF_HEIGHT = 360;
export const NUM_BARS = 100;
export const NUM_BINS = 8;
export const BAR_WIDTH = 4;
export const GAP_WIDTH = 8;
export const MAX_HEIGHT_SCALE = 0.25;
export const WAVE_COLOR = "#808695";
export const BG_COLOR = "#202124";
export const TOTAL_STEPS = 3; // Number of distinct FFmpeg commands