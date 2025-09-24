// --- FFmpeg CDN Configuration ---
export const CORE_VERSION = "0.12.6";
export const FFMPEG_VERSION = "0.12.10";
export const baseURLFFMPEG = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd`;
export const baseURLCore = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
export const baseURLCoreMT = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd`;

// --- Waveform Generation Constants ---
// Note: DURATION is now CHUNK_DURATION for clarity in the video context
export const CHUNK_DURATION = 5;
export const WIDTH = 1280;
export const HEIGHT = 720;
export const HALF_HEIGHT = 360;
export const NUM_BARS = 100;
export const NUM_BINS = 8;
export const BAR_WIDTH = 4;
export const GAP_WIDTH = 8;
export const MAX_HEIGHT_SCALE = 0.25;

// --- Video Specific Constants (from process_chunk.sh) ---
export const FPS = 30;
export const WAVE_COLOR_UNPLAYED = "#808695";
export const WAVE_COLOR_PLAYED = "#a8c7fa";
export const BG_COLOR = "#202124";
export const X_OFFSET = Math.floor((WIDTH - (NUM_BARS * BAR_WIDTH + (NUM_BARS - 1) * GAP_WIDTH)) / 2);