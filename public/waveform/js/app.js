import {initializeFFmpeg} from './ffmpegAudio.js';
import {ffmpegWaveformGenerator} from './ffmpeg-waveform-generator.js';
import {startTimer, stopTimer, formatDurationTimestamp, formatDurationVerbose} from './ui-helpers.js';
import {initDiagnostics, runDiagnostics} from './diagnostics.js';
import {initializeEventListeners} from './event-listeners.js';

class WaveformApp {
    constructor() {
        console.log("App: Constructor called.");
        this.dom = {}; // Populated in init()
        this.ffmpeg = null;
        this.isReady = false;
        this.waveformBlob = null;
        this.measurementsBlob = null;
        this.inputFilenameBase = '';
    }

    init() {
        console.log("App: Initializing DOM elements.");
        const ids = [
            'uploadArea', 'uploadAreaText', 'fileInput', 'inputStatsSection', 'inputStats', 'audioPlayer',
            'executionSection', 'executionIndicator', 'progressBarInner', 'progressText',
            'finalExecutionStats', 'executionTimer', 'outputSection', 'outputInfo',
            'downloadIcon', 'waveformImage', 'downloadButton', 'measurementsSection',
            'measurementsInfo', 'measurementsData', 'downloadMeasurementsIcon',
            'downloadMeasurementsButton', 'consoleHeader', 'diagnosticsSection',
            'ffmpegVersionIndicator', 'mtDiagnostics', 'ffmpegCommand', 'errorContainer',
            'errorBlock', 'ffmpegLogs', 'copyCommandBtn', 'copyLogsBtn', 'copyErrorBtn'
        ];
        ids.forEach(id => this.dom[id] = document.getElementById(id));
        initDiagnostics(); // Initialize the diagnostics module's DOM elements
    }

    async run() {
        console.log("App: Run started.");
        this.displayInitialState();
        runDiagnostics();

        this.dom.uploadAreaText.textContent = 'Loading FFmpeg Core (0%)...';
        this.dom.uploadArea.style.cursor = 'not-allowed';

        const progressCallback = ({total, received}) => {
            if (total > 0) {
                const percentage = Math.round((received / total) * 100);
                this.dom.uploadAreaText.textContent = `Loading FFmpeg Core (${percentage}%)...`;
            }
        };

        this.ffmpeg = await initializeFFmpeg(progressCallback);

        if (!this.ffmpeg) {
            this.updateUI({error: {message: "Critical Error: FFmpeg failed to load. Please refresh the page."}});
            return;
        }

        this.isReady = true;
        const versionInfo = `<strong>Version:</strong> ${this.ffmpeg.version}<br><strong>Mode:</strong> ${window.crossOriginIsolated ? 'Multi-Threaded' : 'Single-Threaded'}`;
        this.updateUI({version: versionInfo});

        initializeEventListeners(this);

        this.dom.uploadAreaText.textContent = 'Click to upload an audio file';
        this.dom.uploadArea.style.cursor = 'pointer';
        console.log("App: Application is ready.");
    }

    async handleFileSelection(file) {
        if (!this.isReady) {
            return;
        }
        console.log(`App: File selected - ${file.name}`);
        this.dom.audioPlayer.src = URL.createObjectURL(file);
        this.displayProcessingState(file);
        const result = await ffmpegWaveformGenerator.generateWaveform(file, this.ffmpeg, (update) => this.updateUI(update));
        if (result) {
            this.updateUI({result});
        }
    }

    displayInitialState() {
        console.log("App: Displaying initial state.");
        if (this.dom.audioPlayer.src) {
            URL.revokeObjectURL(this.dom.audioPlayer.src);
        }
        this.dom.audioPlayer.removeAttribute('src');
        this.dom.uploadArea.style.display = 'block';
        ['inputStatsSection', 'executionSection', 'outputSection', 'measurementsSection', 'errorContainer'].forEach(id => this.dom[id].style.display = 'none');
    }

    displayProcessingState(file) {
        console.log("App: Displaying processing state.");
        this.inputFilenameBase = file.name.split('.').slice(0, -1).join('.');
        ['uploadArea', 'outputSection', 'measurementsSection', 'errorContainer'].forEach(id => this.dom[id].style.display = 'none');
        ['inputStatsSection', 'executionSection'].forEach(id => this.dom[id].style.display = 'block');
        this.dom.inputStats.innerHTML = `<div class="file-line">File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</div><div class="duration-line">Duration: Analyzing...</div>`;
        this.dom.finalExecutionStats.textContent = '';
        startTimer(this.dom.executionTimer);
    }

    updateUI({command, logs, progressStep, result, error, version}) {
        if (command) {
            console.log(`App: Updating command - ${command}`);
            this.dom.ffmpegCommand.textContent = command;
        }
        if (logs) this.dom.ffmpegLogs.textContent += logs;
        if (progressStep) {
            const percentage = Math.round((progressStep.current / progressStep.total) * 100);
            this.dom.progressBarInner.style.width = `${percentage}%`;
            this.dom.progressBarInner.classList.remove('error');
            this.dom.executionIndicator.className = '';
            this.dom.progressText.textContent = `Processing Step ${progressStep.current} of ${progressStep.total}...`;
        }
        if (version) {
            console.log("App: Updating version info.");
            this.dom.ffmpegVersionIndicator.innerHTML = version;
        }
        if (result) {
            console.log("App: Processing successful. Displaying results.");
            stopTimer();
            this.dom.outputSection.style.display = 'block';
            this.dom.measurementsSection.style.display = 'block';
            this.waveformBlob = result.waveformBlob;
            this.measurementsBlob = result.measurementsBlob;
            this.dom.waveformImage.src = URL.createObjectURL(this.waveformBlob);
            this.dom.inputStats.querySelector('.duration-line').textContent = `Duration: ${formatDurationTimestamp(result.audioDuration)} (${formatDurationVerbose(result.audioDuration)})`;
            this.dom.outputInfo.textContent = `${this.inputFilenameBase}_waveform.png (${(this.waveformBlob.size / 1024).toFixed(2)} KB) - ${result.pngWidth}x${result.pngHeight}`;
            this.dom.measurementsInfo.textContent = `${this.inputFilenameBase}_measurements.json (${(this.measurementsBlob.size / 1024).toFixed(2)} KB)`;
            this.dom.measurementsData.textContent = result.measurementsString;
            const speed = result.audioDuration > 0 ? `${(result.audioDuration / (result.executionTime / 1000)).toFixed(2)}x` : 'N/A';
            this.dom.finalExecutionStats.textContent = `Completed | Speed: ${speed}`;
            this.dom.progressText.textContent = 'Success';
            this.dom.executionIndicator.className = 'success';
            const totalSeconds = Math.round(result.executionTime / 1000);
            this.dom.executionTimer.textContent = `${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
        }
        if (error) {
            console.error("App: An error occurred during processing.", error);
            stopTimer();
            this.dom.errorContainer.style.display = 'block';
            this.dom.errorBlock.textContent = error.message;
            this.dom.executionIndicator.className = 'error';
            this.dom.progressText.textContent = 'Failed';
            const executionTime = error.executionTime || 0;
            this.dom.finalExecutionStats.textContent = `Aborted after ${(executionTime / 1000).toFixed(2)}s`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("App: DOM content loaded. Instantiating WaveformApp.");
    const app = new WaveformApp();
    app.init();
    app.run();
});