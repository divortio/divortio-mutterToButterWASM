import {UI} from './ui.js';
import * as Pipeline from './ffmpeg-pipeline.js';
import {initialize as initializeFFmpeg} from './ffmpeg-loader.js';
import {runDiagnostics} from './diagnostics.js';

class App {
    constructor() {
        this.ui = new UI();
        this.ffmpeg = null;
        this.isReady = false;
    }

    async init() {
        this.ui.displayLoadingState();
        runDiagnostics();

        try {
            const onLoadingProgress = (ratio) => this.ui.updateLoadingProgress(ratio);
            this.ffmpeg = await initializeFFmpeg(onLoadingProgress);

            // --- THIS IS THE FIX for the UI bug ---
            // The code to display the version was missing. This adds it back.
            const versionInfo = `<strong>Version:</strong> ${this.ffmpeg.version}<br><strong>Mode:</strong> ${window.crossOriginIsolated ? 'Multi-Threaded' : 'Single-Threaded'}`;
            this.ui.update({version: versionInfo});
            // ------------------------------------------

            this.isReady = true;
            this.ui.initializeEventListeners((file) => this.handleFileSelection(file));
            this.ui.displayInitialState();
            console.log("Application is ready.");

        } catch (error) {
            console.error("Critical Error: FFmpeg failed to load.", error);
            this.ui.handleResult({error: new Error(`FFmpeg failed to load: ${error.message}`), executionTime: 0});
        }
    }

    async handleFileSelection(file) {
        if (!this.isReady || !this.ffmpeg) {
            console.warn("FFmpeg is not ready. Please wait for it to load.");
            return;
        }
        this.ui.displayProcessingState(file);

        const onSubProgress = (ratio) => this.ui.updateSubProgress(ratio);
        const onUpdate = (update) => {
            if (update.type === 'duration') {
                this.ui.updateDuration(update.duration);
            } else {
                this.ui.update(update);
            }
        };

        // Pass the initialized ffmpeg instance to the pipeline
        const result = await Pipeline.generateWaveformVideo(this.ffmpeg, file, onUpdate, onSubProgress);

        this.ui.handleResult(result);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});