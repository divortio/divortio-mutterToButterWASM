import {startTimer, stopTimer, formatDurationTimestamp, formatDurationVerbose} from './helpers.js';

export class UI {
    constructor() {
        this.dom = {};
        const ids = [
            'uploadArea', 'uploadAreaText', 'fileInput', 'inputStatsSection', 'inputStats', 'audioPlayer',
            'executionSection', 'executionIndicator', 'progressBarInner', 'progressText',
            'finalExecutionStats', 'executionTimer', 'outputSection', 'outputInfo',
            'downloadIcon', 'videoPlayer', 'downloadButton', 'measurementsSection',
            'measurementsInfo', 'measurementsData', 'downloadMeasurementsIcon',
            'downloadMeasurementsButton', 'consoleHeader', 'diagnosticsSection',
            'ffmpegVersionIndicator', 'mtDiagnostics', 'ffmpegCommand', 'errorContainer',
            'errorBlock', 'ffmpegLogs', 'copyCommandBtn', 'copyLogsBtn', 'copyErrorBtn',
            'subProgressBar', 'subProgressBarInner', 'stepTimings'
        ];
        ids.forEach(id => this.dom[id] = document.getElementById(id));
        this.videoBlob = null;
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
            a.download = `${this.inputFilenameBase}_waveform.${extension}`;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        this.dom.downloadButton.addEventListener('click', () => downloadAction(this.videoBlob, 'mp4'));
        this.dom.downloadIcon.addEventListener('click', () => downloadAction(this.videoBlob, 'mp4'));
        this.dom.downloadMeasurementsButton.addEventListener('click', () => downloadAction(this.measurementsBlob, 'json'));
        this.dom.downloadMeasurementsIcon.addEventListener('click', () => downloadAction(this.measurementsBlob, 'json'));

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
        this.dom.ffmpegCommand.textContent = '';
        this.dom.errorBlock.textContent = '';
        this.dom.progressText.textContent = 'Initializing...';
        this.dom.progressBarInner.style.width = '0%';
        this.dom.subProgressBar.style.display = 'none';
        this.dom.subProgressBarInner.style.width = '0%';
        this.dom.stepTimings.innerHTML = '';
        startTimer(this.dom.executionTimer);
    }

    updateSubProgress(ratio) {
        this.dom.subProgressBar.style.display = 'block';
        this.dom.subProgressBarInner.style.width = `${ratio * 100}%`;
    }

    updateDuration(duration) {
        this.dom.inputStats.querySelector('.duration-line').textContent = `Duration: ${formatDurationTimestamp(duration)} (${formatDurationVerbose(duration)})`;
    }

    update({command, logs, progressStep, progressMessage, stepTime, version}) {
        if (command) this.dom.ffmpegCommand.textContent = command;
        if (logs) this.dom.ffmpegLogs.textContent += logs;
        if (progressStep) {
            const percentage = Math.round((progressStep.current / progressStep.total) * 100);
            this.dom.progressBarInner.style.width = `${percentage}%`;
            this.dom.executionIndicator.className = '';

            if (stepTime) {
                const timeInfo = `(${(stepTime / 1000).toFixed(2)}s)`;
                this.dom.stepTimings.innerHTML += `<div>${progressMessage}: ${timeInfo}</div>`;
            }

            this.dom.progressText.textContent = progressMessage;

            this.dom.subProgressBar.style.display = 'none';
            this.dom.subProgressBarInner.style.width = '0%';
        }
        if (version) this.dom.ffmpegVersionIndicator.innerHTML = version;
    }

    handleResult({videoBlob, measurementsBlob, measurementsString, audioDuration, executionTime, error}) {
        stopTimer();
        this.dom.subProgressBar.style.display = 'none';

        if (error) {
            this.dom.errorContainer.style.display = 'block';
            this.dom.errorBlock.textContent = error.message; // This will now have the full error
            this.dom.executionIndicator.className = 'error';
            this.dom.progressText.textContent = `Failed: ${error.message.split('\n')[0]}`;
            this.dom.finalExecutionStats.textContent = `Aborted after ${(executionTime / 1000).toFixed(2)}s`;
            return;
        }

        this.dom.outputSection.style.display = 'block';
        this.videoBlob = videoBlob;
        this.measurementsBlob = measurementsBlob;

        if (this.dom.videoPlayer.src) {
            URL.revokeObjectURL(this.dom.videoPlayer.src);
        }
        this.dom.videoPlayer.src = URL.createObjectURL(this.videoBlob);

        this.updateDuration(audioDuration);
        this.dom.outputInfo.textContent = `${this.inputFilenameBase}_waveform.mp4 (${(this.videoBlob.size / 1024 / 1024).toFixed(2)} MB)`;

        const speed = executionTime > 0 ? `${(audioDuration / (executionTime / 1000)).toFixed(2)}x` : 'N/A';
        this.dom.finalExecutionStats.textContent = `Completed | Speed: ${speed}`;

        this.dom.progressText.textContent = 'Success';
        this.dom.executionIndicator.className = 'success';
        const totalSeconds = Math.round(executionTime / 1000);
        this.dom.executionTimer.textContent = `${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
    }
}