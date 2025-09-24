/**
 * @file This module initializes all user interaction event listeners.
 */

/**
 * Initializes all event listeners for the application.
 * @param {object} app - The main application instance.
 */
export function initializeEventListeners(app) {
    console.log("EventListeners: Initializing.");

    // File Input
    app.dom.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            app.handleFileSelection(e.target.files[0]);
        }
    });

    // Console Toggle
    app.dom.consoleHeader.addEventListener('click', () => {
        app.dom.consoleHeader.classList.toggle('collapsed');
        app.dom.diagnosticsSection.style.display = app.dom.diagnosticsSection.style.display === 'none' ? 'block' : 'none';
    });

    // Download Actions
    const downloadAction = () => {
        if (app.waveformBlob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(app.waveformBlob);
            a.download = `${app.inputFilenameBase}_waveform.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };
    app.dom.downloadButton.addEventListener('click', downloadAction);
    app.dom.downloadIcon.addEventListener('click', downloadAction);

    const downloadMeasurementsAction = () => {
        if (app.measurementsBlob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(app.measurementsBlob);
            a.download = `${app.inputFilenameBase}_measurements.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };
    app.dom.downloadMeasurementsButton.addEventListener('click', downloadMeasurementsAction);
    app.dom.downloadMeasurementsIcon.addEventListener('click', downloadMeasurementsAction);

    // Copy Actions
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
    addCopyListener(app.dom.copyCommandBtn, app.dom.ffmpegCommand);
    addCopyListener(app.dom.copyLogsBtn, app.dom.ffmpegLogs);
    addCopyListener(app.dom.copyErrorBtn, app.dom.errorBlock);
}