import {UI} from './ui.js';
import * as FFmpegHandler from './ffmpeg-handler.js';
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
            const onProgress = (ratio) => this.ui.updateLoadingProgress(ratio);
            this.ffmpeg = await FFmpegHandler.initialize(onProgress);
            this.isReady = true;

            const versionInfo = `<strong>Version:</strong> ${this.ffmpeg.version}<br><strong>Mode:</strong> ${window.crossOriginIsolated ? 'Multi-Threaded' : 'Single-Threaded'}`;
            this.ui.update({version: versionInfo});

            this.ui.initializeEventListeners((file) => this.handleFileSelection(file));
            this.ui.displayInitialState();
            console.log("Application is ready.");
        } catch (error) {
            console.error("FFmpeg failed to load.", error);
            this.ui.handleResult({error, executionTime: 0});
        }
    }

    async handleFileSelection(file) {
        if (!this.isReady) {
            console.warn("FFmpeg is not ready. Please wait for it to load.");
            return;
        }
        this.ui.displayProcessingState(file);
        const result = await FFmpegHandler.generateWaveform(file, (update) => this.ui.update(update));
        this.ui.handleResult(result);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});