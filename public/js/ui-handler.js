import {startTimer, stopTimer, formatDurationTimestamp, formatDurationVerbose} from './ui-helpers.js';

export class UIHandler {
    constructor() {
        // The constructor populates the dom object immediately
        this.dom = {};
        const ids = [
            'uploadArea', 'fileInput', 'inputStatsSection', 'inputStats', 'executionSection',
            'executionIndicator', 'progressBarInner', 'progressText', 'finalExecutionStats',
            'executionTimer', 'outputSection', 'outputInfo', 'downloadIcon', 'waveformImage',
            'downloadButton', 'measurementsSection', 'measurementsInfo', 'measurementsData',
            'downloadMeasurementsIcon', 'downloadMeasurementsButton', 'consoleHeader',
            'diagnosticsSection', 'ffmpegVersionIndicator', 'mtDiagnostics', 'ffmpegCommand',
            'errorContainer', 'errorBlock', 'ffmpegLogs', 'copyCommandBtn', 'copyLogsBtn', 'copyErrorBtn'
        ];
        ids.forEach(id => this.dom[id] = document.getElementById(id));

        this.waveformBlob = null;
        this.measurementsBlob = null;
        this.inputFilenameBase = '';
    }

    runDiagnostics() {
        const secure = window.isSecureContext ? '✅ Secure Context (localhost/https)' : '❌ Not a Secure Context';
        let coop = '...';
        let coep = '...';
        try {
            const res = fetch(window.location.href, {method: 'HEAD'}).then(response => {
                coop = response.headers.get('Cross-Origin-Opener-Policy') === 'same-origin' ? '✅ COOP Header: same-origin' : `❌ COOP Header: ${response.headers.get('Cross-Origin-Opener-Policy') || 'not set'}`;
                coep = response.headers.get('Cross-Origin-Embedder-Policy') === 'require-corp' ? '✅ COEP Header: require-corp' : `❌ COEP Header: ${response.headers.get('Cross-Origin-Embedder-Policy') || 'not set'}`;
                this.dom.mtDiagnostics.innerHTML = `${secure}<br>${coop}<br>${coep}<br>${window.crossOriginIsolated ? '✅ Browser is Cross-Origin Isolated' : '❌ Browser is NOT Cross-Origin Isolated'}`;
            });
        } catch (e) {
            coop = '❌ Could not check headers';
            coep = '❌ Could not check headers';
            this.dom.mtDiagnostics.innerHTML = `${secure}<br>${coop}<br>${coep}<br>${window.crossOriginIsolated ? '✅ Browser is Cross-Origin Isolated' : '❌ Browser is NOT Cross-Origin Isolated'}`;
        }
    }

    initializeEventListeners(onFileSelected) {
        this.dom.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                onFileSelected(e.target.files[0]);
            }
        });
        this.dom.consoleHeader.addEventListener('click', () => {
            this.dom.consoleHeader.classList.toggle('collapsed');
            this.dom.diagnosticsSection.style.display = this.dom.diagnosticsSection.style.display === 'none' ? 'block' : 'none';
        });

        const downloadAction = () => {
            if (this.waveformBlob) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(this.waveformBlob);
                a.download = `${this.inputFilenameBase}_waveform.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        };
        this.dom.downloadButton.addEventListener('click', downloadAction);
        this.dom.downloadIcon.addEventListener('click', downloadAction);

        const downloadMeasurementsAction = () => {
            if (this.measurementsBlob) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(this.measurementsBlob);
                a.download = `${this.inputFilenameBase}_measurements.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        };
        this.dom.downloadMeasurementsButton.addEventListener('click', downloadMeasurementsAction);
        this.dom.downloadMeasurementsIcon.addEventListener('click', downloadMeasurementsAction);

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
        ['inputStatsSection', 'executionSection', 'outputSection', 'measurementsSection', 'errorContainer'].forEach(id => this.dom[id].style.display = 'none');
    }

    displayProcessingState(file) {
        this.inputFilenameBase = file.name.split('.').slice(0, -1).join('.');
        ['uploadArea', 'outputSection', 'measurementsSection', 'errorContainer'].forEach(id => this.dom[id].style.display = 'none');
        ['inputStatsSection', 'executionSection'].forEach(id => this.dom[id].style.display = 'block');
        this.dom.inputStats.innerHTML = `<div class="file-line">File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</div><div class="duration-line">Duration: Analyzing...</div>`;
        this.dom.finalExecutionStats.textContent = '';
        startTimer(this.dom.executionTimer);
    }

    updateUI({command, logs, progressStep, result, error}) {
        if (command) this.dom.ffmpegCommand.textContent = command;
        if (logs) this.dom.ffmpegLogs.textContent += logs;
        if (progressStep) {
            const percentage = Math.round((progressStep.current / progressStep.total) * 100);
            this.dom.progressBarInner.style.width = `${percentage}%`;
            this.dom.progressBarInner.classList.remove('error');
            this.dom.executionIndicator.className = '';
            this.dom.progressText.textContent = `Processing Step ${progressStep.current} of ${progressStep.total}...`;
        }
        if (result) {
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
            const speed = result.audioDuration > 0 ? `${(result.executionTime / 1000 / result.audioDuration).toFixed(2)}x` : 'N/A';
            this.dom.finalExecutionStats.textContent = `Completed | Speed: ${speed}`;
            this.dom.progressText.textContent = 'Success';
            this.dom.executionIndicator.className = 'success';
            const totalSeconds = Math.round(result.executionTime / 1000);
            this.dom.executionTimer.textContent = `${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
        }
        if (error) {
            stopTimer();
            this.dom.errorContainer.style.display = 'block';
            this.dom.errorBlock.textContent = error.message;
            this.dom.executionIndicator.className = 'error';
            this.dom.progressText.textContent = 'Failed';
            this.dom.finalExecutionStats.textContent = `Aborted after ${(error.executionTime / 1000).toFixed(2)}s`;
        }
    }

    updateVersion(versionInfo) {
        this.dom.ffmpegVersionIndicator.innerHTML = versionInfo;
    }
}