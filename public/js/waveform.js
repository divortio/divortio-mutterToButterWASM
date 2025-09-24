import {UIHandler} from './ui-handler.js';
import {ffmpegWaveformGenerator} from './ffmpeg-waveform-generator.js';
import {initializeFFmpeg} from './ffmpegAudio.js';

// This is the single entry point for the entire application.
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Create a new instance of the UI handler. Its constructor
    //    will run now that all HTML elements are guaranteed to exist.
    const ui = new UIHandler();

    // 2. Set the initial state of the page
    ui.displayInitialState();
    ui.runDiagnostics();

    // 3. Load FFmpeg
    const ffmpeg = await initializeFFmpeg();
    if (!ffmpeg) {
        console.error("FFmpeg failed to initialize. The application cannot continue.");
        // You could update the UI to show a permanent error here
        return;
    }

    // 4. Update the UI with FFmpeg info
    const versionInfo = `<strong>Version:</strong> ${ffmpeg.version}<br><strong>Mode:</strong> ${window.crossOriginIsolated ? 'Multi-Threaded' : 'Single-Threaded'}`;
    ui.updateVersion(versionInfo);

    // 5. Define the main workflow for when a file is selected
    const handleFileSelection = async (file) => {
        ui.displayProcessingState(file);
        // Pass the initialized ffmpeg instance and the UI handler's update method
        const result = await ffmpegWaveformGenerator.generateWaveform(file, ffmpeg, (update) => ui.updateUI(update));
        if (result) {
            ui.updateUI({result});
        }
    };

    // 6. Activate all user-facing event listeners now that everything is ready
    ui.initializeEventListeners(handleFileSelection);
    console.log("Application is ready.");
});