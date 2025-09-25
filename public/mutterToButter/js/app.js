import {UI} from './ui.js';
import {runMasteringPipeline} from './ffmpeg-pipeline.js';
import {initialize as initializeFFmpeg} from './ffmpeg-loader.js';
import {runDiagnostics} from './diagnostics.js';
import {runFFmpeg} from './ffmpeg-run.js'; // Import the helper

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
            this.ffmpeg = await initializeFFmpeg((ratio) => this.ui.updateLoadingProgress(ratio));
            this.isReady = true;

            const logStore = {
                logs: '',
                append: function (message) {
                    this.logs += message + '\n';
                },
                get: function () {
                    return this.logs;
                },
                clear: function () {
                    this.logs = '';
                }
            };

            // This is the user-provided, correct fix.
            // The global log listener must be attached here to capture all subsequent command outputs.
            this.ffmpeg.on('log', ({message}) => logStore.append(message));

            // --- Get and Display FFmpeg Version ---
            logStore.clear();
            const versionArgs = ['-version'];
            try {
                await runFFmpeg(this.ffmpeg, versionArgs, null, logStore);
            } catch (e) {
                // This is expected as info commands can exit with an error.
            }
            const versionLog = logStore.get();
            this.ui.update({version: versionLog});

            // --- Get and Display Available Filters ---
            // logStore.clear();
            // ffmpeg --help filter=adynamicequalizer
            // const filterDQ = ['--help', 'filter=adynamicequalizer'];
            // try {
            //     await runFFmpeg(this.ffmpeg, filterDQ, null, logStore);
            // } catch (e) {
            //     // This is also expected.
            // }
            // const filterDQAnsser = logStore.get();
            // console.log(filterDQAnsser)

            // --- Get and Display Available Filters ---
            logStore.clear();
            const filterArgs = ['-filters'];
            try {
                await runFFmpeg(this.ffmpeg, filterArgs, null, logStore);
            } catch (e) {
                // This is also expected.
            }
            const filterLog = logStore.get();
            this.ui.updateFilterList(filterLog);

            this.ui.initializeEventListeners((file) => this.handleFileSelection(file));
            this.ui.displayInitialState();
            console.log("Application is ready.");

        } catch (error) {
            console.error("Critical Error during initialization.", error);
            this.ui.handleResult({
                error: new Error(`FFmpeg failed to load or initialize: ${error.message}`),
                executionTime: 0
            });
        }
    }

    async handleFileSelection(file) {
        if (!this.isReady || !this.ffmpeg) {
            console.warn("FFmpeg is not ready. Please wait for it to load.");
            return;
        }
        this.ui.displayProcessingState(file);

        const masteringOptions = this.ui.getMasteringOptions();

        const onUpdate = (update) => {
            if (update.type === 'duration') {
                this.ui.updateDuration(update.duration);
            } else {
                this.ui.update(update);
            }
        };

        const result = await runMasteringPipeline(this.ffmpeg, file, masteringOptions, onUpdate);

        this.ui.handleResult(result);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});