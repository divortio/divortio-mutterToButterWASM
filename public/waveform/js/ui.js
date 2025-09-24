import {startTimer, stopTimer, formatDurationTimestamp, formatDurationVerbose} from './helpers.js';
import {DURATION} from './constants.js';

export class UI {
    constructor() {
        this.dom = {};
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
        this.waveformBlob = null;
        this.measurementsBlob = null;
        this.inputFilenameBase = '';
    }

    initializeEventListeners(onFileSelected) {
        this.dom.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) onFileSelected(e.target.files[0]);
        });

        this.dom.consoleHeader.addEventListener('click', () => {
            this.dom.consoleHeader.classList.toggle('collapsed');
            this.dom.diagnosticsSection.style.display = this.dom.diagnosticsSection.style.display === 'none' ? 'block' : 'none';
        });

        const downloadAction = (blob, extension) => {
            if (!blob) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${this.inputFilenameBase}_${extension}`;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        this.dom.downloadButton.addEventListener('click', () => downloadAction(this.waveformBlob, 'waveform.png'));
        this.dom.downloadIcon.addEventListener('click', () => downloadAction(this.waveformBlob, 'waveform.png'));
        this.dom.downloadMeasurementsButton.addEventListener('click', () => downloadAction(this.measurementsBlob, 'measurements.json'));
        this.dom.downloadMeasurementsIcon.addEventListener('click', () => downloadAction(this.measurementsBlob, 'measurements.json'));

        const addCopyListener = (button, source) => {
            button.addEventListener('click', () => {
                navigator.clipboard.writeText(source.textContent).then(() => {
                    const originalText = button.textContent;
                    button.textContent = 'Copied!';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                });
            });
        };
        addCopyListener(this.dom.copyCommandBtn, this.dom.ffmpegCommand);
        addCopyListener(this.dom.copyLogsBtn, this.dom.ffmpegLogs);
        addCopyListener(this.dom.copyErrorBtn, this.dom.errorBlock);
    }

    displayInitialState() {
        this.dom.uploadArea.style.display = 'block';
        this.dom.uploadAreaText.textContent = 'Click to upload an audio file';
        this.dom.uploadArea.style.cursor = 'pointer';
        ['inputStatsSection', 'executionSection', 'outputSection', 'measurementsSection', 'errorContainer'].forEach(id => this.dom[id].style.display = 'none');
    }

    displayLoadingState(initialMessage = 'Loading FFmpeg Core...') {
        this.dom.uploadAreaText.textContent = initialMessage;
        this.dom.uploadArea.style.cursor = 'not-allowed';
    }

    updateLoadingProgress(percentage) {
        this.displayLoadingState(`Loading FFmpeg Core (${(percentage * 100).toFixed(0)}%)...`);
    }

    displayProcessingState(file) {
        this.inputFilenameBase = file.name.split('.').slice(0, -1).join('.');
        this.dom.audioPlayer.src = URL.createObjectURL(file);
        ['uploadArea', 'outputSection', 'measurementsSection', 'errorContainer'].forEach(id => this.dom[id].style.display = 'none');
        ['inputStatsSection', 'executionSection'].forEach(id => this.dom[id].style.display = 'block');
        this.dom.inputStats.innerHTML = `<div class="file-line">File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</div><div class="duration-line">Duration: Analyzing...</div>`;
        this.dom.finalExecutionStats.textContent = '';
        this.dom.ffmpegLogs.textContent = '';
        startTimer(this.dom.executionTimer);
    }

    update({command, logs, progressStep, version}) {
        if (command) this.dom.ffmpegCommand.textContent = command;
        if (logs) this.dom.ffmpegLogs.textContent += logs;
        if (progressStep) {
            const percentage = Math.round((progressStep.current / progressStep.total) * 100);
            this.dom.progressBarInner.style.width = `${percentage}%`;
            this.dom.executionIndicator.className = '';
            this.dom.progressText.textContent = `Processing Step ${progressStep.current} of ${progressStep.total}...`;
        }
        if (version) this.dom.ffmpegVersionIndicator.innerHTML = version;
    }

    handleResult({
                     waveformBlob,
                     measurementsBlob,
                     measurementsString,
                     audioDuration,
                     executionTime,
                     pngWidth,
                     pngHeight,
                     error
                 }) {
        stopTimer();
        if (error) {
            this.dom.errorContainer.style.display = 'block';
            this.dom.errorBlock.textContent = error.message;
            this.dom.executionIndicator.className = 'error';
            this.dom.progressText.textContent = 'Failed';
            this.dom.finalExecutionStats.textContent = `Aborted after ${(executionTime / 1000).toFixed(2)}s`;
            return;
        }

        this.dom.outputSection.style.display = 'block';
        this.dom.measurementsSection.style.display = 'block';
        this.waveformBlob = waveformBlob;
        this.measurementsBlob = measurementsBlob;
        this.dom.waveformImage.src = URL.createObjectURL(this.waveformBlob);
        this.dom.inputStats.querySelector('.duration-line').textContent = `Duration: ${formatDurationTimestamp(audioDuration)} (${formatDurationVerbose(audioDuration)})`;
        this.dom.outputInfo.textContent = `${this.inputFilenameBase}_waveform.png (${(this.waveformBlob.size / 1024).toFixed(2)} KB) - ${pngWidth}x${pngHeight}`;
        this.dom.measurementsInfo.textContent = `${this.inputFilenameBase}_measurements.json (${(this.measurementsBlob.size / 1024).toFixed(2)} KB)`;
        this.dom.measurementsData.textContent = measurementsString;

        const processedDuration = Math.min(audioDuration, DURATION);
        const speed = executionTime > 0 ? `${(processedDuration / (executionTime / 1000)).toFixed(2)}x` : 'N/A';
        this.dom.finalExecutionStats.textContent = `Completed | Speed: ${speed}`;

        this.dom.progressText.textContent = 'Success';
        this.dom.executionIndicator.className = 'success';
        const totalSeconds = Math.round(executionTime / 1000);
        this.dom.executionTimer.textContent = `${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
    }
}