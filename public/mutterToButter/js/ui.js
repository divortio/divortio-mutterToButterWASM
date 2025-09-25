import {startTimer, stopTimer, formatDurationTimestamp, formatDurationVerbose} from './helpers.js';

export class UI {
    constructor() {
        this.dom = {};
        const ids = [
            'uploadArea', 'uploadAreaText', 'fileInput', 'inputStatsSection', 'inputStats', 'inputAudioPlayer',
            'executionSection', 'executionIndicator', 'progressBarInner', 'progressText',
            'finalExecutionStats', 'executionTimer', 'outputSection', 'outputInfo',
            'downloadIcon', 'outputAudioPlayer', 'downloadButton', 'consoleHeader', 'diagnosticsSection',
            'ffmpegVersionIndicator', 'mtDiagnostics', 'ffmpegCommand', 'errorContainer',
            'errorBlock', 'ffmpegLogs', 'copyCommandBtn', 'copyLogsBtn', 'copyErrorBtn',
            'masteringOptionsSection', 'gateToggle', 'clarityToggle', 'tonalToggle', 'softClipToggle',
            'subProgressBar', 'subProgressBarInner', 'stepTimings', 'ffmpegFilters'
        ];
        ids.forEach(id => this.dom[id] = document.getElementById(id));
        this.audioBlob = null;
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
            a.download = `${this.inputFilenameBase}_mastered.${extension}`;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        this.dom.downloadButton.addEventListener('click', () => downloadAction(this.audioBlob, 'mp3'));
        this.dom.downloadIcon.addEventListener('click', () => downloadAction(this.audioBlob, 'mp3'));

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
        ['inputStatsSection', 'executionSection', 'outputSection', 'masteringOptionsSection', 'errorContainer'].forEach(id => this.dom[id].style.display = 'none');
    }

    displayLoadingState(initialMessage = 'Loading FFmpeg Core...') {
        this.dom.uploadAreaText.textContent = initialMessage;
        this.dom.uploadArea.style.cursor = 'not-allowed';
    }

    updateLoadingProgress(percentage) {
        this.displayLoadingState(`Loading FFmpeg Core (${(percentage * 100).toFixed(0)}%)...`);
    }

    updateFilterList(filterText) {
        if (this.dom.ffmpegFilters) {
            this.dom.ffmpegFilters.textContent = filterText;
        }
    }

    displayProcessingState(file) {
        this.inputFilenameBase = file.name.split('.').slice(0, -1).join('.');
        this.dom.inputAudioPlayer.src = URL.createObjectURL(file);
        ['uploadArea', 'outputSection', 'errorContainer'].forEach(id => this.dom[id].style.display = 'none');
        ['inputStatsSection', 'executionSection', 'masteringOptionsSection'].forEach(id => this.dom[id].style.display = 'block');
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

    getMasteringOptions() {
        return {
            gate: this.dom.gateToggle.checked,
            clarity: this.dom.clarityToggle.checked,
            tonal: this.dom.tonalToggle.checked,
            softClip: this.dom.softClipToggle.checked,
        };
    }

    updateDuration(duration) {
        this.dom.inputStats.querySelector('.duration-line').textContent = `Duration: ${formatDurationTimestamp(duration)} (${formatDurationVerbose(duration)})`;
    }

    update({command, logs, progressStep, progressMessage, subProgressMessage, stepTime, version}) {
        if (command) this.dom.ffmpegCommand.textContent = command;
        if (logs) this.dom.ffmpegLogs.textContent += logs;

        if (version) this.dom.ffmpegVersionIndicator.innerHTML = version;

        if (progressStep) {
            const percentage = Math.round((progressStep.current / progressStep.total) * 100);
            this.dom.progressBarInner.style.width = `${percentage}%`;
            this.dom.executionIndicator.className = '';

            if (stepTime) {
                const timeInfo = `(${(stepTime / 1000).toFixed(2)}s)`;
                this.dom.stepTimings.innerHTML += `<div>${progressMessage}: ${timeInfo}</div>`;
            }
            this.dom.progressText.textContent = progressMessage;
        }

        if (subProgressMessage) {
            this.dom.progressText.textContent = subProgressMessage;
        }
    }

    handleResult({audioBlob, audioDuration, executionTime, error}) {
        stopTimer();
        this.dom.subProgressBar.style.display = 'none';

        if (error) {
            this.dom.errorContainer.style.display = 'block';
            this.dom.errorBlock.textContent = error.message;
            this.dom.executionIndicator.className = 'error';
            this.dom.progressText.textContent = `Failed: ${error.message.split('\n')[0]}`;
            this.dom.finalExecutionStats.textContent = `Aborted after ${(executionTime / 1000).toFixed(2)}s`;
            return;
        }

        this.dom.outputSection.style.display = 'block';
        this.audioBlob = audioBlob;

        if (this.dom.outputAudioPlayer.src) {
            URL.revokeObjectURL(this.dom.outputAudioPlayer.src);
        }
        this.dom.outputAudioPlayer.src = URL.createObjectURL(this.audioBlob);

        this.updateDuration(audioDuration);
        this.dom.outputInfo.textContent = `${this.inputFilenameBase}_mastered.mp3 (${(this.audioBlob.size / 1024 / 1024).toFixed(2)} MB)`;

        const speed = executionTime > 0 ? `${(audioDuration / (executionTime / 1000)).toFixed(2)}x` : 'N/A';
        this.dom.finalExecutionStats.textContent = `Completed | Speed: ${speed}`;

        this.dom.progressText.textContent = 'Success';
        this.dom.executionIndicator.className = 'success';
        const totalSeconds = Math.round(executionTime / 1000);
        this.dom.executionTimer.textContent = `${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
    }
}